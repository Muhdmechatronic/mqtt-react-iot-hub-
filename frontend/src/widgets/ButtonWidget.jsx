import React, { useState, useCallback, useEffect, useRef } from 'react';

const MIN_PRESS_DISPLAY_MS = 200;

export default function ButtonWidget({ title, value, widget, onCommand, settings }) {
  const color   = settings.color    ?? '#0ea5e9';
  const command = settings.command  ?? 'relay';
  const label   = settings.label    ?? title;
  const onVal   = settings.onValue  ?? settings.on_value  ?? '1';
  const offVal  = settings.offValue ?? settings.off_value ?? '0';

  const [pressed, setPressed] = useState(false);
  const pressedRef     = useRef(false);
  const minPressTimer  = useRef(null);
  const guardedRelease = useRef(false);

  useEffect(() => {
    if (value === undefined) return;
    if (pressedRef.current) return;
    const shouldPress = String(value) === String(onVal);
    if (shouldPress) {
      clearTimeout(minPressTimer.current);
      guardedRelease.current = true;
      setPressed(true);
      minPressTimer.current = setTimeout(() => { guardedRelease.current = false; }, MIN_PRESS_DISPLAY_MS);
    } else if (guardedRelease.current) {
      clearTimeout(minPressTimer.current);
      minPressTimer.current = setTimeout(() => { guardedRelease.current = false; setPressed(false); }, MIN_PRESS_DISPLAY_MS);
    } else {
      setPressed(false);
    }
  }, [value, onVal]);

  useEffect(() => () => clearTimeout(minPressTimer.current), []);

  const press = useCallback(() => {
    if (pressedRef.current) return;
    pressedRef.current = true; setPressed(true);
    onCommand(widget.device_id, command, { value: onVal }, widget.data_key);
  }, [widget.device_id, widget.data_key, command, onCommand, onVal]);

  const release = useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false; setPressed(false);
    onCommand(widget.device_id, command, { value: offVal }, widget.data_key);
  }, [widget.device_id, widget.data_key, command, onCommand, offVal]);

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12, userSelect: 'none', background: 'var(--w-bg)' }}>
      <div style={{ fontSize: 12, color: 'var(--w-text-dim)' }}>{title}</div>

      <button
        onMouseDown={press} onMouseUp={release}
        onMouseLeave={() => { if (pressedRef.current) release(); }}
        onTouchStart={e => { e.preventDefault(); press(); }}
        onTouchEnd={e => { e.preventDefault(); release(); }}
        style={{
          background:   pressed ? color : 'transparent',
          border:       `2px solid ${color}`, borderRadius: 10,
          color:        pressed ? '#fff' : color, padding: '14px 30px',
          cursor: 'pointer', fontWeight: 700, fontSize: 14,
          transform:    pressed ? 'scale(0.93) translateY(2px)' : 'scale(1) translateY(0)',
          boxShadow:    pressed ? `inset 0 3px 10px rgba(0,0,0,.3), ${glow}` : `0 4px 16px ${color}33`,
          transition:   'transform 0.07s ease, box-shadow 0.07s ease, background 0.07s ease, color 0.07s ease',
          outline: 'none', minWidth: 80, letterSpacing: '0.5px',
        }}
      >
        {label}
      </button>

      <div style={{ fontSize: 10, fontWeight: 600, color: pressed ? color : 'var(--w-text-muted)', transition: 'color 0.1s', letterSpacing: '1px' }}>
        {pressed ? '● HIGH' : '○ LOW'}
      </div>
    </div>
  );
}
