import React from 'react';

// ── Color threshold utilities ─────────────────────────────────────────────────

function hexToRgb(hex) {
  const clean = (hex || '#38bdf8').replace('#', '');
  const full  = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const val = parseInt(full, 16);
  return [(val >> 16) & 255, (val >> 8) & 255, val & 255];
}

function lerpColor(hex1, hex2, t) {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

function resolveColor(value, settings) {
  if (!settings.colorBasedOnValue || !settings.colorThresholds?.length) {
    return settings.color || '#38bdf8';
  }
  const stops = [...settings.colorThresholds].sort((a, b) => a.threshold - b.threshold);
  const mode  = settings.gradientMode || 'step';
  const v     = parseFloat(value) || 0;

  if (mode === 'step') {
    // Highest threshold that value has reached
    let color = stops[0].colorHex;
    for (const stop of stops) {
      if (v >= stop.threshold) color = stop.colorHex;
    }
    return color;
  }

  // Smooth: interpolate between adjacent stops
  if (v <= stops[0].threshold) return stops[0].colorHex;
  const last = stops[stops.length - 1];
  if (v >= last.threshold) return last.colorHex;
  for (let i = 0; i < stops.length - 1; i++) {
    const lo = stops[i];
    const hi = stops[i + 1];
    if (v >= lo.threshold && v <= hi.threshold) {
      const t = (v - lo.threshold) / (hi.threshold - lo.threshold);
      return lerpColor(lo.colorHex, hi.colorHex, t);
    }
  }
  return last.colorHex;
}

// ── Arc geometry ──────────────────────────────────────────────────────────────

function polarXY(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const s     = polarXY(cx, cy, r, startDeg);
  const e     = polarXY(cx, cy, r, endDeg);
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GaugeWidget({ title, value, settings }) {
  const min  = settings.min  ?? 0;
  const max  = settings.max  ?? 100;
  const unit = settings.unit ?? '';

  const safeVal = value !== undefined ? parseFloat(value) : undefined;
  const pct     = safeVal !== undefined
    ? Math.min(1, Math.max(0, (safeVal - min) / (max - min)))
    : 0;

  const color = resolveColor(safeVal ?? 0, settings);

  const START   = -135;
  const TOTAL   = 270;
  const fillEnd = START + pct * TOTAL;

  const CX = 70; const CY = 78; const R = 54;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px 4px' }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{title}</div>

      <svg width={140} height={110} viewBox="0 0 140 110">
        {/* Track */}
        <path d={arcPath(CX, CY, R, START, START + TOTAL)} fill="none" stroke="#1e293b" strokeWidth={10} strokeLinecap="round" />
        {/* Fill */}
        {safeVal !== undefined && pct > 0 && (
          <path d={arcPath(CX, CY, R, START, fillEnd)} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" style={{ transition: 'stroke 0.3s' }} />
        )}
        {/* Needle */}
        <line
          x1={CX} y1={CY} x2={CX} y2={CY - R + 10}
          stroke={color} strokeWidth={2.5} strokeLinecap="round"
          transform={`rotate(${START + pct * TOTAL}, ${CX}, ${CY})`}
          style={{ transition: 'stroke 0.3s' }}
        />
        <circle cx={CX} cy={CY} r={5} fill={color} style={{ transition: 'fill 0.3s' }} />
        {/* Min/Max labels */}
        <text x={16}  y={106} fontSize={9} fill="#475569" textAnchor="middle">{min}</text>
        <text x={124} y={106} fontSize={9} fill="#475569" textAnchor="middle">{max}</text>
      </svg>

      {/* Value readout */}
      <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', lineHeight: 1, marginTop: -6 }}>
        {safeVal !== undefined ? safeVal.toFixed(1) : '--'}
        <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 3 }}>{unit}</span>
      </div>

      {/* Fill bar */}
      <div style={{ width: 100, height: 4, background: '#1e293b', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s, background 0.3s' }} />
      </div>
    </div>
  );
}
