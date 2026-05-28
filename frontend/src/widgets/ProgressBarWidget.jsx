import React from 'react';

function getBarColor(pct, color) {
  // Shift toward red when > 80%
  if (pct >= 90) return '#ef4444';
  if (pct >= 75) return '#f59e0b';
  return color;
}

export default function ProgressBarWidget({ title, value, settings }) {
  const min   = settings.min        ?? 0;
  const max   = settings.max        ?? 100;
  const unit  = settings.unit       ?? '';
  const color = settings.color      ?? '#0ea5e9';
  const smart = settings.smartColor ?? true;

  const safeVal = value !== undefined ? parseFloat(value) : undefined;
  const pct     = safeVal !== undefined
    ? Math.min(100, Math.max(0, ((safeVal - min) / (max - min)) * 100))
    : 0;

  const barColor = smart ? getBarColor(pct, color) : color;

  return (
    <div
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '8px 18px', gap: 10,
      }}
    >
      {/* Title + value */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{title}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: barColor, transition: 'color 0.4s' }}>
          {safeVal !== undefined ? safeVal.toFixed(1) : '--'}
          {unit && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 3 }}>{unit}</span>}
        </span>
      </div>

      {/* Track */}
      <div style={{ width: '100%', height: 14, background: '#0f172a', borderRadius: 99, overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,.4)' }}>
        <div style={{
          width:        `${pct}%`,
          height:       '100%',
          background:   `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
          borderRadius: 99,
          transition:   'width 0.5s cubic-bezier(.4,0,.2,1), background 0.4s',
          boxShadow:    `0 0 8px ${barColor}66`,
        }} />
      </div>

      {/* Min / pct / max */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569' }}>
        <span>{min}{unit}</span>
        <span style={{ color: barColor, fontWeight: 600, transition: 'color 0.4s' }}>{pct.toFixed(0)}%</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
