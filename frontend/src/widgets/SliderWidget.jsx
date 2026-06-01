import React, { useEffect, useState, useRef, useCallback } from 'react';

const STREAM_INTERVAL_MS = 60;

export default function SliderWidget({ title, value, widget, onCommand, settings }) {
  const min     = settings.min     ?? 0;
  const max     = settings.max     ?? 100;
  const unit    = settings.unit    ?? '';
  const color   = settings.color   ?? '#0ea5e9';
  const command = settings.command ?? 'pwm';

  const [val,      setVal]      = useState(value !== undefined ? parseFloat(value) : min);
  const [dragging, setDragging] = useState(false);
  const lastSentRef  = useRef(0);
  const pendingTimer = useRef(null);

  useEffect(() => {
    if (value !== undefined && !dragging) setVal(parseFloat(value));
  }, [value, dragging]);

  const sendCommand = useCallback((v) => {
    onCommand(widget.device_id, command, { value: parseFloat(v) }, widget.data_key);
  }, [widget.device_id, widget.data_key, command, onCommand]);

  function handleChange(e) {
    const v = parseFloat(e.target.value);
    setVal(v);
    if (!dragging) setDragging(true);
    const now = Date.now();
    if (now - lastSentRef.current >= STREAM_INTERVAL_MS) {
      lastSentRef.current = now;
      sendCommand(v);
      clearTimeout(pendingTimer.current);
    } else {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(() => {
        lastSentRef.current = Date.now();
        sendCommand(v);
      }, STREAM_INTERVAL_MS - (now - lastSentRef.current));
    }
  }

  function handleRelease(e) {
    clearTimeout(pendingTimer.current);
    const v = parseFloat(e.target.value ?? val);
    setDragging(false);
    sendCommand(v);
  }

  const pct = ((val - min) / (max - min)) * 100;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 18px', gap: 8, background: 'var(--w-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--w-text-dim)' }}>{title}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color, transition: 'color .1s' }}>
          {val.toFixed(1)}
          {unit && <span style={{ fontSize: 10, color: 'var(--w-text-muted)', marginLeft: 3 }}>{unit}</span>}
        </span>
      </div>

      <input
        type="range" min={min} max={max} step={(max - min) / 200} value={val}
        onChange={handleChange} onMouseUp={handleRelease} onTouchEnd={handleRelease}
        style={{ width: '100%', accentColor: color, cursor: 'pointer', height: 20 }}
      />

      <div style={{ width: '100%', height: 3, background: 'var(--w-track)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color, borderRadius: 99,
          transition: dragging ? 'none' : 'width 0.3s', boxShadow: `0 0 6px ${color}88`,
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--w-text-muted)' }}>
        <span>{min}{unit}</span>
        {dragging && <span style={{ color, fontSize: 9 }}>streaming…</span>}
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
