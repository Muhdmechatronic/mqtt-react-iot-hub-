import React, { useState, useCallback } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function buildGradientCSS(stops, min, max, mode) {
  if (!stops.length) return 'linear-gradient(90deg, #334155, #334155)';
  const range = max - min || 1;

  const sorted = [...stops].sort((a, b) => a.threshold - b.threshold);
  const points = sorted.map(s => ({
    pct: Math.min(100, Math.max(0, ((s.threshold - min) / range) * 100)),
    hex: s.colorHex,
  }));

  if (mode === 'step') {
    const parts = [];
    points.forEach((p, i) => {
      const nextPct = points[i + 1]?.pct ?? 100;
      parts.push(`${p.hex} ${p.pct.toFixed(1)}%`);
      parts.push(`${p.hex} ${nextPct.toFixed(1)}%`);
    });
    return `linear-gradient(90deg, ${parts.join(', ')})`;
  }

  // smooth
  const parts = points.map(p => `${p.hex} ${p.pct.toFixed(1)}%`);
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

// Returns the interpolated color for a given value
export function getThresholdColor(value, stops, mode) {
  if (!stops.length) return '#38bdf8';
  const sorted = [...stops].sort((a, b) => a.threshold - b.threshold);
  if (value <= sorted[0].threshold) return sorted[0].colorHex;
  if (value >= sorted[sorted.length - 1].threshold) return sorted[sorted.length - 1].colorHex;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (value >= sorted[i].threshold && value <= sorted[i + 1].threshold) {
      if (mode === 'step') return sorted[i].colorHex;
      // smooth: linear interpolation
      const t = (value - sorted[i].threshold) / (sorted[i + 1].threshold - sorted[i].threshold);
      const [r1, g1, b1] = hexToRgb(sorted[i].colorHex);
      const [r2, g2, b2] = hexToRgb(sorted[i + 1].colorHex);
      const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0');
      const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0');
      const b = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }
  return sorted[sorted.length - 1].colorHex;
}

// ── ColorThresholdEditor component ────────────────────────────────────────────
export default function ColorThresholdEditor({ stops, onChange, min = 0, max = 100, mode, onModeChange }) {
  const [editingId, setEditingId] = useState(null);

  const sorted = [...stops].sort((a, b) => a.threshold - b.threshold);
  const gradientCSS = buildGradientCSS(stops, min, max, mode);

  const addStop = useCallback(() => {
    const midThreshold = sorted.length === 0
      ? (min + max) / 2
      : sorted[sorted.length - 1].threshold + (max - sorted[sorted.length - 1].threshold) / 2;
    onChange([...stops, {
      id:        Date.now(),
      threshold: parseFloat(midThreshold.toFixed(2)),
      colorHex:  '#38bdf8',
    }]);
  }, [stops, sorted, min, max, onChange]);

  function updateStop(id, key, val) {
    onChange(stops.map(s => s.id === id ? { ...s, [key]: val } : s));
  }

  function removeStop(id) {
    onChange(stops.filter(s => s.id !== id));
    if (editingId === id) setEditingId(null);
  }

  const range = max - min || 1;

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-wider">Transition Mode</span>
        <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5 gap-0.5">
          {['smooth', 'step'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === m
                  ? 'bg-slate-700 text-sky-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'smooth' ? '⌇ Smooth' : '⌐ Step'}
            </button>
          ))}
        </div>
      </div>

      {/* Gradient preview bar */}
      <div className="relative">
        <div
          className="w-full h-8 rounded-lg border border-slate-700 overflow-hidden"
          style={{ background: gradientCSS }}
        />
        {/* Threshold markers */}
        <div className="absolute inset-0 pointer-events-none">
          {sorted.map(s => {
            const pct = ((s.threshold - min) / range) * 100;
            return (
              <div
                key={s.id}
                className="absolute top-0 bottom-0 w-0.5 bg-white/30"
                style={{ left: `${pct.toFixed(1)}%` }}
              />
            );
          })}
        </div>
        {/* Min / Max labels */}
        <div className="flex justify-between mt-1 text-xs text-slate-600">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>

      {/* Stop list */}
      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="text-center py-4 text-slate-600 text-sm border border-dashed border-slate-800 rounded-lg">
            No color stops — add one to begin
          </div>
        )}
        {sorted.map((s, idx) => (
          <div
            key={s.id}
            className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5"
          >
            {/* Index badge */}
            <span className="text-xs text-slate-600 font-mono w-5 shrink-0">{idx + 1}</span>

            {/* Color swatch + picker */}
            <div className="relative shrink-0">
              <div
                className="w-7 h-7 rounded-md border-2 cursor-pointer"
                style={{ backgroundColor: s.colorHex, borderColor: s.colorHex + '88' }}
                onClick={() => setEditingId(editingId === s.id ? null : s.id)}
              />
              <input
                type="color"
                value={s.colorHex}
                onChange={e => updateStop(s.id, 'colorHex', e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </div>

            {/* Threshold input */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs text-slate-500 shrink-0">≥</span>
              <input
                type="number"
                step="any"
                value={s.threshold}
                onChange={e => updateStop(s.id, 'threshold', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
              />
            </div>

            {/* Color hex label */}
            <span className="text-xs text-slate-600 font-mono w-16 shrink-0">{s.colorHex}</span>

            {/* Delete */}
            <button
              type="button"
              onClick={() => removeStop(s.id)}
              className="text-slate-600 hover:text-rose-400 transition-colors text-sm shrink-0"
              title="Remove stop"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add stop */}
      <button
        type="button"
        onClick={addStop}
        className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-sm text-slate-500 hover:text-sky-400 hover:border-sky-800 transition-colors"
      >
        + Add Color Stop
      </button>
    </div>
  );
}
