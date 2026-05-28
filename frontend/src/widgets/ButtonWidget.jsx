import React, { useState, useCallback, useEffect, useRef } from 'react';

// Minimum time (ms) to hold the pressed state visible after a hardware press.
// Prevents very short --press-time values from being collapsed by React 18 batching
// into a single render that only shows the released state.
const MIN_PRESS_DISPLAY_MS = 200;

export default function ButtonWidget({ title, value, widget, onCommand, settings }) {
  const color   = settings.color    ?? '#0ea5e9';
  const command = settings.command  ?? 'relay';
  const label   = settings.label    ?? title;
  const onVal   = settings.onValue  ?? settings.on_value  ?? '1';
  const offVal  = settings.offValue ?? settings.off_value ?? '0';

  const [pressed, setPressed] = useState(false);

  // Tracks whether the user is physically holding the button via mouse/touch.
  // When true, inbound hardware state is ignored so the local gesture wins.
  const pressedRef = useRef(false);

  // Guard timer: ensures a hardware press is displayed for at least
  // MIN_PRESS_DISPLAY_MS even if the hardware sends 0 immediately after.
  const minPressTimer    = useRef(null);
  const guardedRelease   = useRef(false); // true while inside the guard window

  // ── Hardware / Python simulator inbound state ──────────────────────────────
  // The Python demo writes V4=1 (press) then V4=0 (release) via HTTP.
  // DashboardPage converts that into sensorData and passes it as `value` here.
  // Without this effect, the Button is write-only and ignores all inbound events
  // (which is why the LED on the same pin updates but the Button stays dark).
  useEffect(() => {
    if (value === undefined) return;
    // Never override a live local gesture — user's finger takes priority.
    if (pressedRef.current) return;

    const shouldPress = String(value) === String(onVal);

    if (shouldPress) {
      // Immediately show pressed + start the minimum display guard.
      clearTimeout(minPressTimer.current);
      guardedRelease.current = true;
      setPressed(true);
      minPressTimer.current = setTimeout(() => {
        guardedRelease.current = false;
      }, MIN_PRESS_DISPLAY_MS);
    } else if (guardedRelease.current) {
      // Release arrived while the guard window is still open — defer it so the
      // pressed state is always visible for at least MIN_PRESS_DISPLAY_MS.
      clearTimeout(minPressTimer.current);
      minPressTimer.current = setTimeout(() => {
        guardedRelease.current = false;
        setPressed(false);
      }, MIN_PRESS_DISPLAY_MS);
    } else {
      setPressed(false);
    }
  }, [value, onVal]);

  // Clean up guard timer on unmount.
  useEffect(() => () => clearTimeout(minPressTimer.current), []);

  // ── Local gesture handlers (mouse / touch) ─────────────────────────────────
  const press = useCallback(() => {
    if (pressedRef.current) return;
    pressedRef.current = true;
    setPressed(true);
    onCommand(widget.device_id, command, { value: onVal }, widget.data_key);
  }, [widget.device_id, widget.data_key, command, onCommand, onVal]);

  const release = useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    setPressed(false);
    onCommand(widget.device_id, command, { value: offVal }, widget.data_key);
  }, [widget.device_id, widget.data_key, command, onCommand, offVal]);

  // Release if pointer leaves the window (e.g. user drags off-screen).
  useEffect(() => {
    window.addEventListener('mouseup',  release);
    window.addEventListener('touchend', release);
    return () => {
      window.removeEventListener('mouseup',  release);
      window.removeEventListener('touchend', release);
    };
  }, [release]);

  const glow = `0 0 24px ${color}88, 0 0 48px ${color}44`;

  return (
    <div
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: 12, userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{title}</div>

      <button
        onMouseDown={press}
        onMouseUp={release}
        onMouseLeave={() => { if (pressedRef.current) release(); }}
        onTouchStart={e => { e.preventDefault(); press(); }}
        onTouchEnd={e => { e.preventDefault(); release(); }}
        style={{
          background:    pressed ? color : 'transparent',
          border:        `2px solid ${color}`,
          borderRadius:  10,
          color:         pressed ? '#fff' : color,
          padding:       '14px 30px',
          cursor:        'pointer',
          fontWeight:    700,
          fontSize:      14,
          transform:     pressed ? 'scale(0.93) translateY(2px)' : 'scale(1) translateY(0)',
          boxShadow:     pressed ? `inset 0 3px 10px rgba(0,0,0,.3), ${glow}` : `0 4px 16px ${color}33`,
          transition:    'transform 0.07s ease, box-shadow 0.07s ease, background 0.07s ease, color 0.07s ease',
          outline:       'none',
          minWidth:      80,
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </button>

      <div style={{
        fontSize: 10, fontWeight: 600, color: pressed ? color : '#334155',
        transition: 'color 0.1s', letterSpacing: '1px',
      }}>
        {pressed ? '● HIGH' : '○ LOW'}
      </div>
    </div>
  );
}
