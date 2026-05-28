import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket, ORIGIN_ID } from '../services/socket';
import { useAuth } from '../context/AuthContext';

// ── Type coercion (mirrors backend/utils/coerce.js) ──────────────────────────
function coerceValue(raw, valueType) {
  if (valueType === 'integer') return Math.trunc(Number(raw));
  if (valueType === 'double')  return parseFloat(raw);
  return String(raw ?? '');
}

function inferValueType(raw) {
  if (typeof raw === 'string') return 'string';
  if (!Number.isFinite(raw))   return 'string';
  return Number.isInteger(raw) ? 'integer' : 'double';
}

// ── Sequence counter — monotonically increasing per hook instance ─────────────
let globalSeq = 0;
function nextSeq() { return ++globalSeq; }

// ─────────────────────────────────────────────────────────────────────────────
// useVirtualPinSync
//
// Turns any UI component into a synchronized peer for a single virtual pin.
//
// Usage:
//   const { value, publish, syncing } = useVirtualPinSync(deviceId, 5, {
//     valueType: 'double',
//     debounceMs: 80,      // rapid updates (slider drag) — batched before send
//     widgetId: 'w_1234',
//   });
//
// Returns:
//   value      — current pin value (null until first sync or user interaction)
//   publish(v) — call this when the user changes the widget value
//                immediately updates local state (optimistic) and debounce-sends
//   syncing    — true while an outbound publish is pending server ACK
// ─────────────────────────────────────────────────────────────────────────────

export default function useVirtualPinSync(deviceId, virtualPin, {
  valueType  = null,   // null = infer from first value seen
  debounceMs = 80,
  widgetId   = null,
  writeable  = true,   // false = read-only; skips originId filter so same-page
                       // writes are reflected (LED/Gauge viewing a Slider's pin)
} = {}) {
  const { token }      = useAuth();
  const [value,    setValue]    = useState(null);
  const [syncing,  setSyncing]  = useState(false);

  // Track effective valueType — may be inferred from first inbound payload
  const valueTypeRef  = useRef(valueType);
  const debounceTimer = useRef(null);
  const pendingSeq    = useRef(null);

  // ── Socket reference (stable singleton) ────────────────────────────────────
  const socketRef = useRef(null);
  useEffect(() => {
    if (token) socketRef.current = getSocket(token);
  }, [token]);

  // ── Subscribe on mount, unsubscribe on unmount ─────────────────────────────
  useEffect(() => {
    if (!deviceId || virtualPin === null || virtualPin === undefined) return;
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('pin:subscribe', {
      deviceId:   String(deviceId),
      pins:       [virtualPin],
    });

    return () => {
      // Don't unsubscribe the device room — other widgets on the same page
      // may still need it. The hook only stops listening to pin:update events
      // via the handler removal below.
    };
  }, [deviceId, virtualPin]);

  // ── Inbound handler — SYNC and UPDATE events ───────────────────────────────
  useEffect(() => {
    if (!deviceId || virtualPin === null || virtualPin === undefined) return;
    const socket = socketRef.current;
    if (!socket) return;

    function handlePinUpdate(payload) {
      // Only process payloads for our device+pin pair.
      if (String(payload.deviceId) !== String(deviceId)) return;
      if (payload.virtualPin !== virtualPin)              return;

      // Ignore echoes from this same browser session — but only when the widget
      // is writeable. A read-only widget (LED, Gauge) set writeable=false must
      // NOT suppress same-page events, because the server already excludes the
      // sending socket and the optimistic update only lives in the sender's local
      // state. Without this, an LED on the same page as a Switch will never see
      // the Switch's change reflected via the inbound path.
      if (writeable && payload.originId === ORIGIN_ID) return;

      // Infer valueType from first inbound payload if not specified.
      if (!valueTypeRef.current) {
        valueTypeRef.current = payload.valueType || inferValueType(payload.value);
      }

      const normalized = coerceValue(payload.value, valueTypeRef.current);
      setValue(normalized);
    }

    function handlePinSync(payloads) {
      // pin:sync arrives as an array; find the one matching this hook's pin.
      const match = payloads.find(p =>
        String(p.deviceId) === String(deviceId) && p.virtualPin === virtualPin
      );
      if (!match) return;

      if (!valueTypeRef.current) {
        valueTypeRef.current = match.valueType || inferValueType(match.value);
      }
      setValue(coerceValue(match.value, valueTypeRef.current));
    }

    function handleAck({ virtualPin: ackPin, seq }) {
      if (ackPin !== virtualPin) return;
      if (seq === pendingSeq.current) {
        setSyncing(false);
        pendingSeq.current = null;
      }
    }

    socket.on('pin:update', handlePinUpdate);
    socket.on('pin:sync',   handlePinSync);
    socket.on('pin:ack',    handleAck);

    return () => {
      socket.off('pin:update', handlePinUpdate);
      socket.off('pin:sync',   handlePinSync);
      socket.off('pin:ack',    handleAck);
    };
  }, [deviceId, virtualPin, writeable]);

  // ── Outbound publish with optimistic update + debounce ────────────────────
  const publish = useCallback((newValue) => {
    if (!deviceId || virtualPin === null || virtualPin === undefined) return;
    const socket = socketRef.current;
    if (!socket) return;

    // Infer the value type from this first user interaction if not yet known.
    if (!valueTypeRef.current) {
      valueTypeRef.current = inferValueType(newValue);
    }

    const normalized = coerceValue(newValue, valueTypeRef.current);

    // Optimistic update — local state reflects the change immediately,
    // before the server round-trip completes.
    setValue(normalized);
    setSyncing(true);

    // Debounce outbound send — collapses rapid drags into a single message.
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const seq = nextSeq();
      pendingSeq.current = seq;

      const payload = {
        schema:     'iot/pin/v1',
        event:      'WRITE',
        originId:   ORIGIN_ID,
        deviceId:   String(deviceId),
        virtualPin,
        widgetId,
        value:      normalized,
        valueType:  valueTypeRef.current,
        timestamp:  Date.now(),
        seq,
      };

      socket.emit('pin:write', payload);

      // Safety timeout — if no ACK arrives in 5 s, clear the syncing indicator.
      setTimeout(() => {
        if (pendingSeq.current === seq) {
          setSyncing(false);
          pendingSeq.current = null;
        }
      }, 5000);
    }, debounceMs);
  }, [deviceId, virtualPin, debounceMs, widgetId]);

  return { value, publish, syncing };
}
