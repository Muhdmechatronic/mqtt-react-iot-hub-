import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Section, JsonPreview } from './GaugeSettings';

// ── Live slider preview ───────────────────────────────────────────────────────
function SliderPreview({ cfg, min, max, unit }) {
  const [val, setVal] = useState((min + max) / 2);
  const [dragging, setDragging] = useState(false);
  const lastSentRef  = useRef(0);
  const pendingTimer = useRef(null);
  const [lastSent, setLastSent] = useState(null);

  const step    = parseFloat(cfg.handleStep) || 1;
  const showFine = cfg.showFineControls;
  const onRight  = cfg.valuePosition === 'right';

  function clamp(v) {
    const snapped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, parseFloat(snapped.toFixed(10))));
  }

  function fireCommand(v) {
    setLastSent(v);
  }

  function onSliderChange(e) {
    const v = clamp(parseFloat(e.target.value));
    setVal(v);
    setDragging(true);

    if (!cfg.sendOnReleaseOnly) {
      const now = Date.now();
      if (now - lastSentRef.current >= 60) {
        lastSentRef.current = now;
        fireCommand(v);
        clearTimeout(pendingTimer.current);
      } else {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = setTimeout(() => {
          lastSentRef.current = Date.now();
          fireCommand(v);
        }, 60 - (now - lastSentRef.current));
      }
    }
  }

  function onRelease(e) {
    const v = clamp(parseFloat(e.target.value));
    setDragging(false);
    clearTimeout(pendingTimer.current);
    fireCommand(v);
  }

  function adjust(delta) {
    const next = clamp(val + delta * step);
    setVal(next);
    fireCommand(next);
  }

  const pct = ((val - min) / ((max - min) || 1)) * 100;

  const valueEl = (
    <div className="flex flex-col items-center justify-center shrink-0 min-w-[52px]">
      <span className="text-lg font-bold text-sky-400 font-mono leading-tight">
        {val.toFixed(step < 1 ? (step < 0.1 ? 3 : 2) : 1)}
      </span>
      {unit && <span className="text-xs text-slate-500">{unit}</span>}
    </div>
  );

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
      <div className="text-xs text-slate-500 text-center">{cfg.title || 'Slider'} · Live Preview</div>

      {/* Main slider row */}
      <div className="flex items-center gap-3">
        {!onRight && valueEl}

        <div className="flex-1 space-y-2">
          {/* Fine controls */}
          {showFine && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => adjust(-1)}
                className="w-8 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 text-sm font-bold transition-colors"
              >−</button>
              <div className="flex-1 text-center text-xs text-slate-600 font-mono">
                step: {step}
              </div>
              <button
                type="button"
                onClick={() => adjust(+1)}
                className="w-8 h-7 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 text-sm font-bold transition-colors"
              >+</button>
            </div>
          )}

          {/* Track */}
          <input
            type="range"
            min={min} max={max} step={step}
            value={val}
            onChange={onSliderChange}
            onMouseUp={onRelease}
            onTouchEnd={onRelease}
            className="w-full h-2 cursor-pointer"
          />

          {/* Fill bar */}
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-none"
              style={{
                width: `${pct}%`,
                boxShadow: '0 0 6px #0ea5e966',
              }}
            />
          </div>

          {/* Min / max / status */}
          <div className="flex justify-between text-xs text-slate-600">
            <span>{min}{unit}</span>
            <span className={dragging && !cfg.sendOnReleaseOnly ? 'text-sky-600 animate-pulse' : ''}>
              {dragging && !cfg.sendOnReleaseOnly ? '⬤ streaming…' : lastSent !== null ? `↑ sent: ${lastSent}` : ''}
            </span>
            <span>{max}{unit}</span>
          </div>
        </div>

        {onRight && valueEl}
      </div>

      {/* Mode badge */}
      <div className="flex justify-center gap-2 text-xs">
        <span className={`px-2 py-0.5 rounded-full border ${
          cfg.sendOnReleaseOnly
            ? 'border-amber-800 text-amber-500 bg-amber-950/30'
            : 'border-sky-800 text-sky-400 bg-sky-950/30'
        }`}>
          {cfg.sendOnReleaseOnly ? '⬆ Release only' : '⬤ Streaming'}
        </span>
        {showFine && (
          <span className="px-2 py-0.5 rounded-full border border-slate-700 text-slate-400">
            ± Fine controls
          </span>
        )}
      </div>
    </div>
  );
}

// ── Step preset buttons ───────────────────────────────────────────────────────
const STEP_PRESETS = [
  { label: '0.001', value: 0.001 },
  { label: '0.01',  value: 0.01  },
  { label: '0.1',   value: 0.1   },
  { label: '1',     value: 1     },
  { label: '5',     value: 5     },
  { label: '10',    value: 10    },
];

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
export default function SliderSettings({ datastreams, initialConfig = {}, onChange }) {
  const [cfg, setCfg] = useState({
    title:             '',
    datastreamId:      '',
    sendOnReleaseOnly: false,
    handleStep:        '1',
    showFineControls:  true,
    valuePosition:     'right',
    ...initialConfig,
  });

  useEffect(() => { onChange?.(cfg); }, [cfg]);

  function set(k, v) { setCfg(p => ({ ...p, [k]: v })); }

  const ds = datastreams.find(d => String(d.id) === String(cfg.datastreamId));

  // Datastream bounds are LOCKED — slider inherits them
  const lockedMin  = ds?.min_value ?? 0;
  const lockedMax  = ds?.max_value ?? 100;
  const lockedUnit = ds?.unit || '';

  return (
    <div className="space-y-6">
      {/* ── Live preview ── */}
      <SliderPreview
        cfg={cfg}
        min={lockedMin}
        max={lockedMax}
        unit={lockedUnit}
      />

      {/* ── Widget ── */}
      <Section title="Widget">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Title</label>
            <input
              type="text"
              value={cfg.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Fan Speed"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Datastream</label>
            <select
              value={cfg.datastreamId}
              onChange={e => set('datastreamId', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
            >
              <option value="">— select datastream —</option>
              {datastreams.filter(d => d.data_type !== 'string').map(d => (
                <option key={d.id} value={d.id}>
                  V{d.virtual_pin} · {d.display_name} ({d.data_type})
                </option>
              ))}
            </select>

            {/* Locked bounds display */}
            {ds ? (
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-mono">
                {[
                  { label: 'MIN (locked)', val: lockedMin },
                  { label: 'MAX (locked)', val: lockedMax },
                  { label: 'UNIT',         val: lockedUnit || '—' },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-center">
                    <div className="text-slate-600 text-[10px] uppercase tracking-wider">{label}</div>
                    <div className="text-slate-300 text-sm mt-0.5">{val}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-600 mt-2">Select a numeric datastream to bind slider bounds.</div>
            )}
          </div>
        </div>
      </Section>

      {/* ── Transmission ── */}
      <Section title="Transmission">
        <ToggleField
          label="Send on Release Only"
          hint="If OFF, values stream continuously while dragging"
          value={cfg.sendOnReleaseOnly}
          onChange={v => set('sendOnReleaseOnly', v)}
        />
        <div className={`text-xs rounded-lg px-3 py-2 mt-1 border ${
          cfg.sendOnReleaseOnly
            ? 'border-amber-800/50 bg-amber-950/20 text-amber-600'
            : 'border-sky-800/50 bg-sky-950/20 text-sky-600'
        }`}>
          {cfg.sendOnReleaseOnly
            ? '⬆ Payload dispatched once when user releases handle'
            : '⬤ Continuous stream — payload dispatched ~60ms during drag'}
        </div>
      </Section>

      {/* ── Granularity ── */}
      <Section title="Granularity">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Handle Step
          </label>
          {/* Presets */}
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {STEP_PRESETS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => set('handleStep', String(p.value))}
                className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
                  parseFloat(cfg.handleStep) === p.value
                    ? 'bg-sky-900/50 border-sky-600 text-sky-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            step="any"
            min="0.001"
            value={cfg.handleStep}
            onChange={e => set('handleStep', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-600"
            placeholder="1"
          />
          <p className="text-xs text-slate-600 mt-1">
            Slider snaps to multiples of this value during drag.
          </p>
        </div>
      </Section>

      {/* ── Display ── */}
      <Section title="Display Controls">
        <ToggleField
          label="Show Fine Controls"
          hint="Renders ± micro-adjustment buttons beside the slider"
          value={cfg.showFineControls}
          onChange={v => set('showFineControls', v)}
        />

        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Value Position
          </label>
          <div className="flex gap-2">
            {[
              { label: '← Left',  value: 'left'  },
              { label: 'Right →', value: 'right' },
            ].map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => set('valuePosition', o.value)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${
                  cfg.valuePosition === o.value
                    ? 'bg-sky-900/40 border-sky-600 text-sky-300 font-semibold'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <JsonPreview data={{
        type:             'slider',
        title:            cfg.title,
        datastreamId:     cfg.datastreamId,
        sendOnReleaseOnly: cfg.sendOnReleaseOnly,
        handleStep:       parseFloat(cfg.handleStep) || 1,
        showFineControls: cfg.showFineControls,
        valuePosition:    cfg.valuePosition,
      }} />
    </div>
  );
}
