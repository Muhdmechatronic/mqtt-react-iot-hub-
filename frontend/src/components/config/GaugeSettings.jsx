import React, { useState, useEffect } from 'react';
import ColorThresholdEditor, { getThresholdColor } from './ColorThresholdEditor';

// ── Mini live gauge preview ───────────────────────────────────────────────────
function GaugePreview({ value, min, max, color }) {
  const pct    = Math.min(1, Math.max(0, (value - min) / ((max - min) || 1)));
  const START  = -135;
  const TOTAL  = 270;
  const CX     = 60; const CY = 66; const R = 46;

  function polarXY(deg) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  }
  function arc(from, to) {
    const s = polarXY(from);
    const e = polarXY(to);
    return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  }

  return (
    <svg width={120} height={92} viewBox="0 0 120 92" className="mx-auto">
      <path d={arc(START, START + TOTAL)} fill="none" stroke="#1e293b" strokeWidth={8} strokeLinecap="round" />
      {pct > 0 && (
        <path d={arc(START, START + pct * TOTAL)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
      )}
      <line
        x1={CX} y1={CY} x2={CX} y2={CY - R + 8}
        stroke={color} strokeWidth={2} strokeLinecap="round"
        transform={`rotate(${START + pct * TOTAL}, ${CX}, ${CY})`}
      />
      <circle cx={CX} cy={CY} r={4} fill={color} />
      <text x={12} y={88} fontSize={8} fill="#475569" textAnchor="middle">{min}</text>
      <text x={108} y={88} fontSize={8} fill="#475569" textAnchor="middle">{max}</text>
    </svg>
  );
}

// ── Field primitives ──────────────────────────────────────────────────────────
const Field = ({ label, children, hint }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
    {children}
    {hint && <p className="text-xs text-slate-600">{hint}</p>}
  </div>
);

const TextInput = ({ value, onChange, placeholder, disabled }) => (
  <input
    type="text"
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
  />
);

const NumInput = ({ value, onChange, disabled, placeholder }) => (
  <input
    type="number"
    step="any"
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    placeholder={placeholder}
    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600 disabled:opacity-40 disabled:cursor-not-allowed font-mono transition-colors"
  />
);

function ToggleField({ label, hint, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-800 last:border-0">
      <div>
        <div className="text-sm text-slate-200">{label}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-11 h-6 rounded-full border-2 transition-all duration-200 ${
          value ? 'bg-sky-500 border-sky-500 shadow-[0_0_10px_#0ea5e966]' : 'bg-slate-800 border-slate-700'
        }`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
          value ? 'left-5' : 'left-0.5'
        }`} />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GaugeSettings({ datastreams, initialConfig = {}, onChange }) {
  const [cfg, setCfg] = useState({
    title:             '',
    datastreamId:      '',
    overrideMinMax:    false,
    customMin:         '0',
    customMax:         '100',
    colorBasedOnValue: false,
    colorHex:          '#38bdf8',
    colorThresholds:   [
      { id: 1, threshold: 0,   colorHex: '#22c55e' },
      { id: 2, threshold: 60,  colorHex: '#f59e0b' },
      { id: 3, threshold: 85,  colorHex: '#ef4444' },
    ],
    gradientMode:      'smooth',
    ...initialConfig,
  });

  const [previewVal, setPreviewVal] = useState(50);

  useEffect(() => { onChange?.(cfg); }, [cfg]);

  function set(k, v) { setCfg(p => ({ ...p, [k]: v })); }

  const ds = datastreams.find(d => String(d.id) === String(cfg.datastreamId));

  const effectiveMin = cfg.overrideMinMax ? parseFloat(cfg.customMin) || 0  : (ds?.min_value ?? 0);
  const effectiveMax = cfg.overrideMinMax ? parseFloat(cfg.customMax) || 100 : (ds?.max_value ?? 100);
  const unit         = ds?.unit || '';

  const currentColor = cfg.colorBasedOnValue
    ? getThresholdColor(previewVal, cfg.colorThresholds, cfg.gradientMode)
    : cfg.colorHex;

  return (
    <div className="space-y-6">
      {/* ── Gauge preview ── */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
        <div className="text-xs text-slate-500 mb-1">{cfg.title || 'Gauge'}</div>
        <GaugePreview value={previewVal} min={effectiveMin} max={effectiveMax} color={currentColor} />
        <div className="text-xl font-bold mt-1" style={{ color: currentColor }}>
          {previewVal.toFixed(1)}<span className="text-xs text-slate-500 ml-1">{unit}</span>
        </div>
        <input
          type="range"
          min={effectiveMin} max={effectiveMax} step={0.1}
          value={previewVal}
          onChange={e => setPreviewVal(parseFloat(e.target.value))}
          className="w-full mt-3 h-1"
        />
        <div className="text-xs text-slate-600 mt-1">Drag to preview</div>
      </div>

      {/* ── Widget ── */}
      <Section title="Widget">
        <Field label="Title">
          <TextInput value={cfg.title} onChange={v => set('title', v)} placeholder="e.g. Temperature" />
        </Field>
        <Field label="Datastream">
          <select
            value={cfg.datastreamId}
            onChange={e => set('datastreamId', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
          >
            <option value="">— select datastream —</option>
            {datastreams.map(d => (
              <option key={d.id} value={d.id}>
                V{d.virtual_pin} · {d.display_name} ({d.data_type})
              </option>
            ))}
          </select>
          {ds && (
            <div className="mt-2 flex gap-3 text-xs text-slate-500 font-mono bg-slate-950 rounded-lg px-3 py-2 border border-slate-800">
              <span>min: <span className="text-slate-300">{ds.min_value ?? '—'}</span></span>
              <span>max: <span className="text-slate-300">{ds.max_value ?? '—'}</span></span>
              <span>unit: <span className="text-slate-300">{ds.unit || '—'}</span></span>
            </div>
          )}
        </Field>
      </Section>

      {/* ── Value Range ── */}
      <Section title="Value Range">
        <ToggleField
          label="Override Min / Max"
          hint="Use custom range instead of datastream bounds"
          value={cfg.overrideMinMax}
          onChange={v => set('overrideMinMax', v)}
        />
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Field label="Min">
            <NumInput
              value={cfg.customMin}
              onChange={v => set('customMin', v)}
              disabled={!cfg.overrideMinMax}
              placeholder={String(ds?.min_value ?? 0)}
            />
          </Field>
          <Field label="Max">
            <NumInput
              value={cfg.customMax}
              onChange={v => set('customMax', v)}
              disabled={!cfg.overrideMinMax}
              placeholder={String(ds?.max_value ?? 100)}
            />
          </Field>
        </div>
        {!cfg.overrideMinMax && ds && (
          <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-800" />
            Locked to datastream: {effectiveMin} → {effectiveMax}
          </div>
        )}
      </Section>

      {/* ── Color ── */}
      <Section title="Color">
        <ToggleField
          label="Color based on value"
          hint="Multi-stop gradient changes color as value changes"
          value={cfg.colorBasedOnValue}
          onChange={v => set('colorBasedOnValue', v)}
        />

        {!cfg.colorBasedOnValue && (
          <Field label="Static Color">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 shrink-0">
                <div
                  className="w-9 h-9 rounded-lg border border-slate-700"
                  style={{ background: cfg.colorHex }}
                />
                <input
                  type="color"
                  value={cfg.colorHex}
                  onChange={e => set('colorHex', e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </div>
              <span className="text-sm text-slate-400 font-mono">{cfg.colorHex}</span>
            </div>
          </Field>
        )}

        {cfg.colorBasedOnValue && (
          <div className="pt-1">
            <ColorThresholdEditor
              stops={cfg.colorThresholds}
              onChange={v => set('colorThresholds', v)}
              min={effectiveMin}
              max={effectiveMax}
              mode={cfg.gradientMode}
              onModeChange={v => set('gradientMode', v)}
            />
          </div>
        )}
      </Section>

      {/* JSON preview */}
      <JsonPreview data={cfg} />
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
export function Section({ title, children }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/50">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

export function JsonPreview({ data }) {
  const [open, setOpen] = useState(false);
  const json = {
    type:            'gauge',
    title:           data.title,
    datastreamId:    data.datastreamId,
    overrideMinMax:  data.overrideMinMax,
    ...(data.overrideMinMax && {
      customMin: parseFloat(data.customMin),
      customMax: parseFloat(data.customMax),
    }),
    colorBasedOnValue: data.colorBasedOnValue,
    ...(data.colorBasedOnValue
      ? { colorThresholds: data.colorThresholds, gradientMode: data.gradientMode }
      : { colorHex: data.colorHex }),
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:text-slate-400 transition-colors"
      >
        <span className="font-mono">settings_json preview</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className="px-4 pb-4 text-xs text-emerald-400 font-mono overflow-x-auto scrollbar-thin">
          {JSON.stringify(json, null, 2)}
        </pre>
      )}
    </div>
  );
}
