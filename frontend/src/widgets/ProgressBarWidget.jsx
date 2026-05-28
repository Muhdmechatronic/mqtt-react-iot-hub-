import React from 'react';

// Shared with GaugeWidget — resolves color from threshold stops or solid color
function resolveColor(value, settings) {
  if (!settings.colorBasedOnValue || !settings.colorThresholds?.length) {
    return settings.color ?? '#0ea5e9';
  }
  const stops = [...settings.colorThresholds].sort((a, b) => a.threshold - b.threshold);
  const mode  = settings.gradientMode || 'step';
  const v     = parseFloat(value) || 0;

  if (mode === 'step') {
    let color = stops[0].colorHex;
    for (const stop of stops) {
      if (v >= stop.threshold) color = stop.colorHex;
    }
    return color;
  }

  // Smooth interpolation
  if (v <= stops[0].threshold) return stops[0].colorHex;
  const last = stops[stops.length - 1];
  if (v >= last.threshold) return last.colorHex;
  for (let i = 0; i < stops.length - 1; i++) {
    const lo = stops[i], hi = stops[i + 1];
    if (v >= lo.threshold && v <= hi.threshold) {
      const t   = (v - lo.threshold) / (hi.threshold - lo.threshold);
      const hex = (h) => {
        const c = h.replace('#','');
        const full = c.length === 3 ? c.split('').map(x => x+x).join('') : c;
        const n = parseInt(full, 16);
        return [(n>>16)&255,(n>>8)&255,n&255];
      };
      const [r1,g1,b1] = hex(lo.colorHex);
      const [r2,g2,b2] = hex(hi.colorHex);
      return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
    }
  }
  return last.colorHex;
}

export default function ProgressBarWidget({ title, value, settings }) {
  const min  = settings.min  ?? 0;
  const max  = settings.max  ?? 100;
  const unit = settings.unit ?? '';

  const safeVal = value !== undefined ? parseFloat(value) : undefined;
  const pct     = safeVal !== undefined
    ? Math.min(100, Math.max(0, ((safeVal - min) / (max - min)) * 100))
    : 0;

  const barColor = resolveColor(safeVal ?? 0, settings);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 18px', gap: 10, background: 'var(--w-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'var(--w-text-dim)' }}>{title}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: barColor, transition: 'color 0.4s' }}>
          {safeVal !== undefined ? safeVal.toFixed(1) : '--'}
          {unit && <span style={{ fontSize: 11, color: 'var(--w-text-muted)', marginLeft: 3 }}>{unit}</span>}
        </span>
      </div>

      <div style={{ width: '100%', height: 14, background: 'var(--w-bg2)', borderRadius: 99, overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,.1)' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
          borderRadius: 99,
          transition: 'width 0.5s cubic-bezier(.4,0,.2,1)',
          boxShadow: `0 0 8px ${barColor}66`,
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--w-text-muted)' }}>
        <span>{min}{unit}</span>
        <span style={{ color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
