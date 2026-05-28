import React, { useEffect, useState } from 'react';

export default function SwitchWidget({ title, value, widget, onCommand, settings }) {
  const color    = settings.color     ?? '#0ea5e9';
  const command  = settings.command   ?? 'relay';
  const onVal    = settings.on_value  ?? '1';
  const offVal   = settings.off_value ?? '0';

  const showLabels = settings.show_labels    ?? false;
  const onLabel    = settings.on_label       ?? 'ON';
  const offLabel   = settings.off_label      ?? 'OFF';
  const labelPos   = settings.label_position ?? 'right';
  const hideTitle  = settings.hide_title     ?? false;

  const [on, setOn] = useState(
    value !== undefined ? String(value) === String(onVal) : false
  );

  useEffect(() => {
    if (value !== undefined) setOn(String(value) === String(onVal));
  }, [value, onVal]);

  function toggle() {
    const next = !on;
    setOn(next);
    onCommand(widget.device_id, command, { value: next ? onVal : offVal, state: next ? 1 : 0 }, widget.data_key);
  }

  const labelEl = showLabels && (
    <div style={{
      fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
      color: on ? color : '#475569', transition: 'color 0.2s',
      minWidth: 52,
      textAlign: labelPos === 'left' ? 'right' : 'left',
    }}>
      {on ? onLabel : offLabel}
    </div>
  );

  return (
    <div
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12,
      }}
    >
      {!hideTitle && <div style={{ fontSize: 12, color: '#94a3b8' }}>{title}</div>}

      {/* Track + optional labels */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {showLabels && labelPos === 'left' && labelEl}

        {/* Track */}
        <div
          onClick={toggle}
          role="switch"
          aria-checked={on}
          style={{
            display:    'flex', width: 64, height: 34, borderRadius: 99,
            background: on ? color : '#1e293b',
            border:     `2px solid ${on ? color : '#334155'}`,
            cursor:     'pointer', position: 'relative',
            transition: 'background 0.25s cubic-bezier(.4,0,.2,1), border-color 0.25s, box-shadow 0.25s',
            boxShadow:  on ? `0 0 14px ${color}88, 0 0 24px ${color}44` : '0 2px 6px rgba(0,0,0,.4)',
            flexShrink: 0,
          }}
        >
          {/* Thumb */}
          <div style={{
            position:   'absolute',
            top:        3, left: on ? 32 : 3,
            width:      24, height: 24, borderRadius: '50%',
            background: on ? '#fff' : '#475569',
            boxShadow:  on ? '0 2px 8px rgba(0,0,0,.4)' : '0 1px 3px rgba(0,0,0,.3)',
            transition: 'left 0.25s cubic-bezier(.34,1.56,.64,1), background 0.25s',
          }} />
        </div>

        {showLabels && labelPos === 'right' && labelEl}
      </div>

      {/* State text when labels hidden */}
      {!showLabels && (
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '1px',
          color: on ? color : '#475569', transition: 'color 0.2s',
        }}>
          {on ? 'ON' : 'OFF'}
        </div>
      )}
    </div>
  );
}
