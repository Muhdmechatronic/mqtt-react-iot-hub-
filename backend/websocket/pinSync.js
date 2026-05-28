const deviceService = require('../services/deviceService');
const { coerceValue, inferValueType } = require('../utils/coerce');

// ── In-memory pin state cache ─────────────────────────────────────────────────
// Key:   "deviceId:virtualPin"
// Value: full validated payload (last known good state per pin)
//
// This is the hot read path for SYNC events on subscribe.
// It does NOT replace the sensor_data table — that stores time-series history.

const pinCache = new Map();

function cacheKey(deviceId, pin) {
  return `${deviceId}:${pin}`;
}

function getCached(deviceId, virtualPin) {
  return pinCache.get(cacheKey(deviceId, virtualPin)) ?? null;
}

function setCached(deviceId, virtualPin, entry) {
  pinCache.set(cacheKey(deviceId, virtualPin), entry);
}

// ── Payload validator & normalizer ────────────────────────────────────────────

function validatePayload(raw) {
  const pin = parseInt(raw?.virtualPin);
  if (!raw?.deviceId)                                   return { err: 'missing deviceId' };
  if (isNaN(pin) || pin < 0 || pin > 255)               return { err: 'virtualPin must be 0–255' };
  if (!raw?.originId)                                   return { err: 'missing originId' };
  if (raw?.value === undefined || raw?.value === null)   return { err: 'missing value' };

  const valueType = raw.valueType || inferValueType(raw.value);
  const value     = coerceValue(raw.value, valueType);

  return {
    payload: {
      schema:     'iot/pin/v1',
      event:      'WRITE',
      originId:   String(raw.originId),
      deviceId:   String(raw.deviceId),
      virtualPin: pin,
      widgetId:   raw.widgetId ?? null,
      value,
      valueType,
      timestamp:  Number.isInteger(raw.timestamp) ? raw.timestamp : Date.now(),
      seq:        Number.isInteger(raw.seq) ? raw.seq : 0,
    }
  };
}

// ── Sequence guard ────────────────────────────────────────────────────────────
// Discards stale payloads when two sources race to update the same pin.
// Tracks highest seq seen per (originId, deviceId, virtualPin) triplet.

const seqTracker = new Map();

function isStale(payload) {
  const k    = `${payload.originId}:${payload.deviceId}:${payload.virtualPin}`;
  const last = seqTracker.get(k) ?? -1;
  if (payload.seq <= last) return true;
  seqTracker.set(k, payload.seq);
  return false;
}

// ── Broadcast helpers ─────────────────────────────────────────────────────────

// Web client or hardware → exclude the originating socket to prevent echo loops.
function broadcastPinUpdate(io, originSocketId, payload) {
  io.to(`device:${payload.deviceId}`).except(originSocketId).emit('pin:update', payload);
}

// External origin (MQTT, REST) → broadcast to entire room (no socket to exclude).
function broadcastPinUpdateFromExternal(io, payload) {
  io.to(`device:${payload.deviceId}`).emit('pin:update', payload);
}

// ── Socket.io event handlers ──────────────────────────────────────────────────

function registerHandlers(io, socket) {
  // Subscribe: join the device room and receive an immediate SYNC of current pin state.
  socket.on('pin:subscribe', async ({ deviceId, pins }) => {
    if (!deviceId) return;
    socket.join(`device:${deviceId}`);

    const pinList = Array.isArray(pins) ? pins : (pins !== undefined ? [pins] : []);
    const syncPayloads = pinList
      .map(p => getCached(deviceId, p))
      .filter(Boolean)
      .map(entry => ({ ...entry, event: 'SYNC' }));

    if (syncPayloads.length) {
      socket.emit('pin:sync', syncPayloads);
    }
  });

  socket.on('pin:unsubscribe', ({ deviceId }) => {
    socket.leave(`device:${deviceId}`);
  });

  // WRITE: a widget or hardware client writes a new pin value.
  socket.on('pin:write', async (raw) => {
    const { payload, err } = validatePayload(raw);
    if (err) return socket.emit('pin:error', { error: err, raw });

    // Ownership check — the authenticated user must own this device.
    const device = await deviceService.getDeviceById(parseInt(payload.deviceId));
    if (!device || device.user_id !== socket.data.userId) {
      return socket.emit('pin:error', { error: 'forbidden', deviceId: payload.deviceId });
    }

    if (isStale(payload)) return;

    setCached(payload.deviceId, payload.virtualPin, payload);
    broadcastPinUpdate(io, socket.id, payload);

    // ACK back to the sender with server-confirmed timestamp.
    socket.emit('pin:ack', {
      virtualPin: payload.virtualPin,
      seq:        payload.seq,
      serverTs:   Date.now(),
    });
  });

  // Hardware reconnect: send back the current cached state for requested pins.
  socket.on('pin:request_sync', async ({ deviceId, pins }) => {
    const device = await deviceService.getDeviceById(parseInt(deviceId));
    if (!device) return;

    const pinList = Array.isArray(pins) ? pins : [];
    const syncPayloads = pinList
      .map(p => getCached(deviceId, p))
      .filter(Boolean)
      .map(entry => ({ ...entry, event: 'SYNC' }));

    if (syncPayloads.length) {
      socket.emit('pin:sync', syncPayloads);
    }
  });
}

module.exports = {
  registerHandlers,
  broadcastPinUpdateFromExternal,
  setCached,
  getCached,
  validatePayload,
};
