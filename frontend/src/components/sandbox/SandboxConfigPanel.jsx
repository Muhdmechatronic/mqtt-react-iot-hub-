/**
 * SandboxConfigPanel — right-side slide-in configuration panel for the Sandbox builder.
 * Contains all widget forms (Gauge, Slider, Switch, Button, LED, Chart, generic).
 * Receives `mockValue` to show the current simulated live reading.
 */
import React, { useEffect, useState } from 'react';
import api from '../../services/api';

// ── Primitive UI components ───────────────────────────────────────────────────

function Field({ label, sub, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {sub && <span style={{ color: '#334155', fontWeight: 400, textTransform: 'none', fontSize: 10 }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

const iStyle = {
  display: 'block', width: '100%', background: '#020617', border: '1px solid #1e293b',
  borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      style={iStyle}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={e => { e.target.style.borderColor = '#0284c7'; }}
      onBlur={e =>  { e.target.style.borderColor = '#1e293b'; }}
    />
  );
}

function NumberInput({ value, onChange, placeholder, min, max }) {
  return (
    <input
      type="number" step="any" min={min} max={max}
      style={iStyle}
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
      placeholder={placeholder}
      onFocus={e => { e.target.style.borderColor = '#0284c7'; }}
      onBlur={e =>  { e.target.style.borderColor = '#1e293b'; }}
    />
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onMouseDown={e => e.stopPropagation()}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 40, height: 22, borderRadius: 99,
        background: checked ? '#0284c7' : '#1e293b',
        border: `1px solid ${checked ? '#0369a1' : '#334155'}`,
        cursor: 'pointer', padding: 0, flexShrink: 0,
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.4)',
        transition: 'left 0.2s', left: checked ? 20 : 2,
      }} />
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #0f172a' }}>
      <div>
        <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{desc}</div>}
      </div>
      <Toggle checked={!!checked} onChange={onChange} />
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, borderRadius: 8,
            border: `1px solid ${value === opt.value ? '#0369a1' : '#1e293b'}`,
            background: value === opt.value ? '#0c2a3f' : '#0f172a',
            color: value === opt.value ? '#38bdf8' : '#475569',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input
        type="color"
        value={value ?? '#38bdf8'}
        onChange={e => onChange(e.target.value)}
        style={{ width: 40, height: 36, border: '1px solid #1e293b', borderRadius: 8, background: '#020617', cursor: 'pointer', padding: 2 }}
      />
      <input
        type="text"
        value={value ?? '#38bdf8'}
        onChange={e => onChange(e.target.value)}
        style={{ ...iStyle, width: 90, fontFamily: 'monospace', fontSize: 12 }}
        onFocus={e => { e.target.style.borderColor = '#0284c7'; }}
        onBlur={e =>  { e.target.style.borderColor = '#1e293b'; }}
      />
    </div>
  );
}

function DatastreamSelect({ deviceId, value, onChange }) {
  const [streams, setStreams] = useState([]);
  useEffect(() => {
    if (!deviceId) return;
    api.get(`/datastream?device_id=${deviceId}`)
      .then(r => setStreams(r.data))
      .catch(() => {});
  }, [deviceId]);
  return (
    <select
      style={{ ...iStyle, cursor: 'pointer' }}
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      onFocus={e => { e.target.style.borderColor = '#0284c7'; }}
      onBlur={e =>  { e.target.style.borderColor = '#1e293b'; }}
    >
      <option value="">— None —</option>
      {streams.map(s => (
        <option key={s.id} value={s.id}>
          V{s.virtual_pin} · {s.display_name}{s.unit ? ` (${s.unit})` : ''} · {s.access_type || 'READ_WRITE'}
        </option>
      ))}
    </select>
  );
}

// ── Gauge: multi-stop color threshold editor ──────────────────────────────────

const DEFAULT_THRESHOLDS = [
  { id: 1, threshold: 0,  colorHex: '#22c55e' },
  { id: 2, threshold: 60, colorHex: '#f59e0b' },
  { id: 3, threshold: 80, colorHex: '#ef4444' },
];

function ColorThresholdSection({ stops, mode, onChange }) {
  const safeStops = stops?.length ? stops : DEFAULT_THRESHOLDS;
  const sorted    = [...safeStops].sort((a, b) => a.threshold - b.threshold);
  const gradient  = sorted.length > 1
    ? `linear-gradient(to right, ${sorted.map(s => s.colorHex).join(', ')})`
    : (sorted[0]?.colorHex || '#38bdf8');

  const update = (idx, updated) => onChange({ stops: safeStops.map((s, i) => i === idx ? updated : s), mode });
  const add    = () => onChange({ stops: [...safeStops, { id: Date.now(), threshold: 0, colorHex: '#38bdf8' }], mode });
  const remove = (idx) => onChange({ stops: safeStops.filter((_, i) => i !== idx), mode });

  return (
    <div>
      {/* Gradient preview bar */}
      <div style={{ height: 10, borderRadius: 99, background: gradient, marginBottom: 12 }} />

      {/* Step vs Smooth */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['step', 'smooth'].map(m => (
          <button
            key={m}
            type="button"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onChange({ stops: safeStops, mode: m })}
            style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 99, cursor: 'pointer',
              border: `1px solid ${mode === m ? '#0369a1' : '#1e293b'}`,
              background: mode === m ? '#0c2a3f' : '#0f172a',
              color: mode === m ? '#38bdf8' : '#334155',
              fontWeight: mode === m ? 700 : 400,
            }}
          >
            {m === 'step' ? '◼ Step' : '◐ Smooth'}
          </button>
        ))}
      </div>

      {/* Color stops */}
      {safeStops.map((stop, idx) => (
        <div key={stop.id ?? idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="color"
            value={stop.colorHex}
            onChange={e => update(idx, { ...stop, colorHex: e.target.value })}
            style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: 4 }}
          />
          <span style={{ fontSize: 11, color: '#334155' }}>≥</span>
          <input
            type="number"
            value={stop.threshold}
            onChange={e => update(idx, { ...stop, threshold: parseFloat(e.target.value) || 0 })}
            style={{ flex: 1, background: '#020617', border: '1px solid #1e293b', borderRadius: 6, color: '#e2e8f0', padding: '4px 8px', fontSize: 12, outline: 'none' }}
          />
          {safeStops.length > 1 && (
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => remove(idx)}
              style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#334155'; }}
            >✕</button>
          )}
        </div>
      ))}

      <button
        type="button"
        onMouseDown={e => e.stopPropagation()}
        onClick={add}
        style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: 12, padding: 0 }}
      >
        + Add color stop
      </button>
    </div>
  );
}

// ── Per-type form bodies ──────────────────────────────────────────────────────

const STEP_PRESETS = [0.001, 0.01, 0.1, 1, 5, 10];

function GaugeForm({ s, set, deviceId }) {
  return (
    <>
      <Field label="Title">
        <TextInput value={s.title} onChange={v => set('title', v)} placeholder="e.g. Temperature" />
      </Field>
      <Field label="Datastream (Virtual Pin)">
        <DatastreamSelect deviceId={deviceId} value={s.datastreamId} onChange={v => set('datastreamId', v)} />
      </Field>
      <ToggleRow label="Override Min / Max" desc="Use custom bounds instead of datastream values"
        checked={s.overrideMinMax} onChange={v => set('overrideMinMax', v)} />
      {s.overrideMinMax && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingLeft: 12, borderLeft: '2px solid #1e293b', marginTop: 12, marginBottom: 4 }}>
          <Field label="Min"><NumberInput value={s.customMin} onChange={v => set('customMin', v)} placeholder="0" /></Field>
          <Field label="Max"><NumberInput value={s.customMax} onChange={v => set('customMax', v)} placeholder="100" /></Field>
        </div>
      )}
      <ToggleRow label="Color Based on Value" desc="Multi-stop dynamic color mapping"
        checked={s.colorBasedOnValue}
        onChange={v => {
          set('colorBasedOnValue', v);
          if (v && (!s.colorThresholds || !s.colorThresholds.length)) {
            set('colorThresholds', DEFAULT_THRESHOLDS.map(t => ({ ...t, id: Date.now() + t.id })));
            set('gradientMode', 'step');
          }
        }}
      />
      {s.colorBasedOnValue ? (
        <div style={{ paddingLeft: 12, borderLeft: '2px solid #1e293b', marginTop: 12 }}>
          <ColorThresholdSection
            stops={s.colorThresholds}
            mode={s.gradientMode ?? 'step'}
            onChange={({ stops, mode }) => { set('colorThresholds', stops); set('gradientMode', mode); }}
          />
        </div>
      ) : (
        <Field label="Gauge Color">
          <ColorPicker value={s.colorHex ?? '#38bdf8'} onChange={v => set('colorHex', v)} />
        </Field>
      )}
    </>
  );
}

function SliderForm({ s, set, deviceId }) {
  return (
    <>
      <Field label="Title">
        <TextInput value={s.title} onChange={v => set('title', v)} placeholder="e.g. Fan Speed" />
      </Field>
      <Field label="Datastream (Virtual Pin)">
        <DatastreamSelect deviceId={deviceId} value={s.datastreamId} onChange={v => set('datastreamId', v)} />
      </Field>
      <ToggleRow label="Send on Release Only" desc="Reduces MQTT traffic during drag"
        checked={s.sendOnReleaseOnly} onChange={v => set('sendOnReleaseOnly', v)} />
      <Field label="Step Size">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STEP_PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => set('handleStep', p)}
              style={{
                padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace',
                background: (s.handleStep ?? 1) === p ? '#0c2a3f' : '#0f172a',
                border: `1px solid ${(s.handleStep ?? 1) === p ? '#0369a1' : '#1e293b'}`,
                color: (s.handleStep ?? 1) === p ? '#38bdf8' : '#475569',
              }}
            >{p}</button>
          ))}
        </div>
      </Field>
      <ToggleRow label="Show Fine Controls" desc="± precision micro-buttons beside slider"
        checked={s.showFineControls} onChange={v => set('showFineControls', v)} />
      <Field label="Value Position">
        <Segmented value={s.valuePosition ?? 'right'}
          options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
          onChange={v => set('valuePosition', v)}
        />
      </Field>
    </>
  );
}

function SwitchButtonForm({ s, set, deviceId }) {
  return (
    <>
      <Field label="Title">
        <TextInput value={s.title} onChange={v => set('title', v)} placeholder="e.g. Pump Relay" />
      </Field>
      <ToggleRow label="Hide Widget Name" desc="Conceal title label on dashboard"
        checked={s.hideTitle} onChange={v => set('hideTitle', v)} />
      <Field label="Datastream (Virtual Pin)">
        <DatastreamSelect deviceId={deviceId} value={s.datastreamId} onChange={v => set('datastreamId', v)} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="ON Value">
          <TextInput value={s.onValue ?? '1'} onChange={v => set('onValue', v)} placeholder="1" />
        </Field>
        <Field label="OFF Value">
          <TextInput value={s.offValue ?? '0'} onChange={v => set('offValue', v)} placeholder="0" />
        </Field>
      </div>
      <ToggleRow label="Show Labels" desc="Display ON/OFF text beside the toggle"
        checked={s.showLabels} onChange={v => set('showLabels', v)} />
      {s.showLabels && (
        <div style={{ paddingLeft: 12, borderLeft: '2px solid #1e293b' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <Field label="ON Label">
              <TextInput value={s.onLabel ?? 'ON'} onChange={v => set('onLabel', v)} />
            </Field>
            <Field label="OFF Label">
              <TextInput value={s.offLabel ?? 'OFF'} onChange={v => set('offLabel', v)} />
            </Field>
          </div>
          <Field label="Label Position">
            <Segmented value={s.labelPosition ?? 'right'}
              options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
              onChange={v => set('labelPosition', v)}
            />
          </Field>
        </div>
      )}
      <Field label="Accent Color">
        <ColorPicker value={s.color ?? '#0ea5e9'} onChange={v => set('color', v)} />
      </Field>
    </>
  );
}

function LEDForm({ s, set, deviceId }) {
  const mode = s.ledMode ?? 'binary';
  return (
    <>
      <Field label="Title">
        <TextInput value={s.title} onChange={v => set('title', v)} placeholder="e.g. Status Indicator" />
      </Field>
      <ToggleRow label="Hide Widget Name" desc="Conceal title label on dashboard"
        checked={s.hideTitle} onChange={v => set('hideTitle', v)} />
      <Field label="Datastream (Virtual Pin)">
        <DatastreamSelect deviceId={deviceId} value={s.datastreamId} onChange={v => set('datastreamId', v)} />
      </Field>
      <Field label="Active LED Color">
        <ColorPicker value={s.colorOn ?? '#22c55e'} onChange={v => set('colorOn', v)} />
      </Field>
      <Field label="Value Mode">
        <Segmented
          value={mode}
          options={[{ value: 'binary', label: 'Binary ON/OFF' }, { value: 'pwm', label: 'PWM Brightness' }]}
          onChange={v => set('ledMode', v)}
        />
      </Field>
      {mode === 'binary' ? (
        <Field label="ON Threshold" sub="value ≥ threshold → LED on">
          <NumberInput value={s.threshold ?? 0.5} onChange={v => set('threshold', v)} placeholder="0.5" min={0} />
        </Field>
      ) : (
        <div style={{ paddingLeft: 12, borderLeft: '2px solid #1e293b' }}>
          <div style={{ fontSize: 11, color: '#475569', padding: '6px 0 10px' }}>
            LED opacity scales 0 → 100% between Min and Max values.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Min (dim)">
              <NumberInput value={s.pwmMin ?? 0} onChange={v => set('pwmMin', v)} placeholder="0" />
            </Field>
            <Field label="Max (bright)">
              <NumberInput value={s.pwmMax ?? 100} onChange={v => set('pwmMax', v)} placeholder="100" />
            </Field>
          </div>
        </div>
      )}
    </>
  );
}

function ChartForm({ s, set, deviceId }) {
  return (
    <>
      <Field label="Title">
        <TextInput value={s.title} onChange={v => set('title', v)} placeholder="e.g. Sensor History" />
      </Field>
      <Field label="Datastream (Virtual Pin)">
        <DatastreamSelect deviceId={deviceId} value={s.datastreamId} onChange={v => set('datastreamId', v)} />
      </Field>
      <Field label="Chart Type">
        <Segmented
          value={s.chartType ?? 'area'}
          options={[{ value: 'line', label: 'Line' }, { value: 'area', label: 'Area' }, { value: 'bar', label: 'Bar' }]}
          onChange={v => set('chartType', v)}
        />
      </Field>
      <Field label="Time Window">
        <Segmented
          value={s.timeWindow ?? '1h'}
          options={[{ value: 'live', label: 'Live' }, { value: '1h', label: '1h' }, { value: '24h', label: '24h' }]}
          onChange={v => set('timeWindow', v)}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="X-Axis Label">
          <TextInput value={s.xAxisTitle ?? ''} onChange={v => set('xAxisTitle', v)} placeholder="Time" />
        </Field>
        <Field label="Y-Axis Label">
          <TextInput value={s.yAxisTitle ?? ''} onChange={v => set('yAxisTitle', v)} placeholder="Value" />
        </Field>
      </div>
      <Field label="Line Color">
        <ColorPicker value={s.colorHex ?? '#38bdf8'} onChange={v => set('colorHex', v)} />
      </Field>
    </>
  );
}

function GenericForm({ s, set, type }) {
  return (
    <>
      <Field label="Title">
        <TextInput value={s.title ?? ''} onChange={v => set('title', v)} placeholder={`${type} title`} />
      </Field>
      <div style={{ fontSize: 12, color: '#475569', paddingTop: 8, borderTop: '1px solid #0f172a' }}>
        Extended settings for <code style={{ color: '#38bdf8' }}>{type}</code> are configured on the live dashboard.
      </div>
    </>
  );
}

// ── Type registry ─────────────────────────────────────────────────────────────
const TYPE_META = {
  gauge:       { icon: '🎯', label: 'Gauge' },
  slider:      { icon: '🎚', label: 'Slider' },
  switch:      { icon: '🔘', label: 'Switch' },
  button:      { icon: '🟦', label: 'Push Button' },
  linechart:   { icon: '📈', label: 'Line Chart' },
  led:         { icon: '💡', label: 'LED Indicator' },
  progressbar: { icon: '📊', label: 'Progress Bar' },
};

// ── Mock value display ────────────────────────────────────────────────────────
function LiveSyncBadge({ mockValue, type }) {
  if (mockValue === null || mockValue === undefined) return null;
  const isToggle = type === 'switch' || type === 'button';
  const display  = isToggle
    ? (mockValue ? 'ON (1)' : 'OFF (0)')
    : typeof mockValue === 'number' ? mockValue.toFixed(2) : String(mockValue);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px', background: '#020c1a', borderRadius: 8,
      border: '1px solid #1e3a5f', marginBottom: 16,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
      <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Simulated feed</span>
      <code style={{ marginLeft: 'auto', fontSize: 12, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700 }}>
        {display}
      </code>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function SandboxConfigPanel({ widget, deviceId, mockValue, onClose, onSave }) {
  const [settings, setSettings] = useState(() => ({ ...widget.settings }));
  const meta = TYPE_META[widget.type] || { icon: '⚙', label: widget.type };

  // Reset form when target widget changes
  useEffect(() => {
    setSettings({ ...widget.settings });
  }, [widget.id]);

  function set(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onSave({ ...widget, settings });
  }

  return (
    <div style={{
      width: 320, flexShrink: 0,
      background: '#0f172a', borderLeft: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        background: '#0a1525',
      }}>
        <div>
          <div style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace', letterSpacing: '1px', marginBottom: 3 }}>
            WIDGET SETTINGS
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
            {meta.icon} {meta.label}
          </div>
        </div>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onClose}
          style={{ width: 30, height: 30, background: '#1e293b', border: 'none', borderRadius: 8, color: '#64748b', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >✕</button>
      </div>

      {/* Scrollable form body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {/* Live sync indicator */}
        <LiveSyncBadge mockValue={mockValue} type={widget.type} />

        {widget.type === 'gauge'      && <GaugeForm       s={settings} set={set} deviceId={deviceId} />}
        {widget.type === 'slider'     && <SliderForm      s={settings} set={set} deviceId={deviceId} />}
        {(widget.type === 'switch' || widget.type === 'button') && (
          <SwitchButtonForm s={settings} set={set} deviceId={deviceId} />
        )}
        {widget.type === 'led'        && <LEDForm         s={settings} set={set} deviceId={deviceId} />}
        {widget.type === 'linechart'  && <ChartForm       s={settings} set={set} deviceId={deviceId} />}
        {!['gauge','slider','switch','button','led','linechart'].includes(widget.type) && (
          <GenericForm s={settings} set={set} type={widget.type} />
        )}
      </div>

      {/* Footer — Apply / Discard */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onClose}
          style={{ flex: 1, padding: '9px 0', background: 'none', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#334155'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; }}
        >
          Discard
        </button>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={handleApply}
          style={{ flex: 2, padding: '9px 0', background: '#0284c7', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#0369a1'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#0284c7'; }}
        >
          ✓ Apply Settings
        </button>
      </div>
    </div>
  );
}
