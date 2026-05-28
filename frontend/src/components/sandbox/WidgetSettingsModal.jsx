import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';

// ── Primitive field components ─────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  display: 'block', width: '100%', background: '#020617', border: '1px solid #1e293b',
  borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      style={inputStyle}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={e => { e.target.style.borderColor = '#0284c7'; }}
      onBlur={e => { e.target.style.borderColor = '#1e293b'; }}
    />
  );
}

function NumberInput({ value, onChange }) {
  return (
    <input
      type="number"
      style={{ ...inputStyle, width: '100%' }}
      value={value ?? ''}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      onFocus={e => { e.target.style.borderColor = '#0284c7'; }}
      onBlur={e => { e.target.style.borderColor = '#1e293b'; }}
    />
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 40, height: 22, borderRadius: 99,
        background: checked ? '#0284c7' : '#1e293b', border: '1px solid ' + (checked ? '#0369a1' : '#334155'),
        cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background 0.2s, border-color 0.2s',
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
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function SegmentedControl({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '7px 0', fontSize: 13, fontWeight: 600, borderRadius: 8,
            border: '1px solid ' + (value === opt.value ? '#0369a1' : '#1e293b'),
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
      style={{ ...inputStyle, cursor: 'pointer' }}
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      onFocus={e => { e.target.style.borderColor = '#0284c7'; }}
      onBlur={e => { e.target.style.borderColor = '#1e293b'; }}
    >
      <option value="">— None —</option>
      {streams.map(s => (
        <option key={s.id} value={s.id}>
          V{s.virtual_pin} · {s.display_name} {s.unit ? `(${s.unit})` : ''}
        </option>
      ))}
    </select>
  );
}

// ── Compact colour threshold editor ───────────────────────────────────────────

function ColorStop({ stop, onChange, onRemove, canRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <input
        type="color"
        value={stop.colorHex}
        onChange={e => onChange({ ...stop, colorHex: e.target.value })}
        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: 4 }}
      />
      <span style={{ fontSize: 11, color: '#334155' }}>≥</span>
      <input
        type="number"
        value={stop.threshold}
        onChange={e => onChange({ ...stop, threshold: parseFloat(e.target.value) || 0 })}
        style={{ flex: 1, background: '#020617', border: '1px solid #1e293b', borderRadius: 6, color: '#e2e8f0', padding: '4px 8px', fontSize: 12, outline: 'none' }}
      />
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#334155'; }}
        >✕</button>
      )}
    </div>
  );
}

function ColorThresholdSection({ stops = [], mode = 'step', onChange }) {
  const sorted = [...stops].sort((a, b) => a.threshold - b.threshold);
  const gradient = sorted.length > 1
    ? `linear-gradient(to right, ${sorted.map(s => s.colorHex).join(', ')})`
    : sorted[0]?.colorHex || '#38bdf8';

  function updateStop(idx, updated) {
    onChange({ stops: stops.map((s, i) => i === idx ? updated : s), mode });
  }
  function addStop() {
    onChange({ stops: [...stops, { id: Date.now(), threshold: 0, colorHex: '#38bdf8' }], mode });
  }
  function removeStop(idx) {
    onChange({ stops: stops.filter((_, i) => i !== idx), mode });
  }

  return (
    <div>
      {/* Gradient preview bar */}
      <div style={{ height: 10, borderRadius: 99, background: gradient, marginBottom: 12 }} />

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['step', 'smooth'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ stops, mode: m })}
            style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 99, cursor: 'pointer',
              border: `1px solid ${mode === m ? '#0369a1' : '#1e293b'}`,
              background: mode === m ? '#0c2a3f' : '#0f172a',
              color: mode === m ? '#38bdf8' : '#334155',
              fontWeight: mode === m ? 700 : 400,
            }}
          >
            {m === 'step' ? 'Step' : 'Smooth'}
          </button>
        ))}
      </div>

      {/* Stops */}
      {stops.map((stop, idx) => (
        <ColorStop
          key={stop.id ?? idx}
          stop={stop}
          onChange={updated => updateStop(idx, updated)}
          onRemove={() => removeStop(idx)}
          canRemove={stops.length > 1}
        />
      ))}

      <button
        type="button"
        onClick={addStop}
        style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: 12, padding: 0 }}
      >
        + Add stop
      </button>
    </div>
  );
}

// ── Per-type form bodies ───────────────────────────────────────────────────────

const STEP_PRESETS = [0.001, 0.01, 0.1, 1, 5, 10];

function GaugeForm({ settings, set, deviceId }) {
  return (
    <>
      <Field label="Title">
        <TextInput value={settings.title} onChange={v => set('title', v)} placeholder="e.g. Room Temperature" />
      </Field>
      <Field label="Datastream">
        <DatastreamSelect deviceId={deviceId} value={settings.datastreamId} onChange={v => set('datastreamId', v)} />
      </Field>
      <ToggleRow
        label="Override Datastream Min/Max"
        desc="Use custom value bounds instead"
        checked={!!settings.overrideMinMax}
        onChange={v => set('overrideMinMax', v)}
      />
      {settings.overrideMinMax && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingLeft: 12, borderLeft: '2px solid #1e293b', marginTop: 12, marginBottom: 4 }}>
          <Field label="Custom Min"><NumberInput value={settings.customMin} onChange={v => set('customMin', v)} /></Field>
          <Field label="Custom Max"><NumberInput value={settings.customMax} onChange={v => set('customMax', v)} /></Field>
        </div>
      )}
      <ToggleRow
        label="Change color based on value"
        desc="Multi-stop threshold mapping"
        checked={!!settings.colorBasedOnValue}
        onChange={v => set('colorBasedOnValue', v)}
      />
      {settings.colorBasedOnValue ? (
        <div style={{ paddingLeft: 12, borderLeft: '2px solid #1e293b', marginTop: 12 }}>
          <ColorThresholdSection
            stops={settings.colorThresholds ?? [{ id: 1, threshold: 0, colorHex: '#22c55e' }]}
            mode={settings.gradientMode ?? 'step'}
            onChange={({ stops, mode }) => { set('colorThresholds', stops); set('gradientMode', mode); }}
          />
        </div>
      ) : (
        <Field label="Gauge Color">
          <input
            type="color"
            value={settings.colorHex ?? '#38bdf8'}
            onChange={e => set('colorHex', e.target.value)}
            style={{ width: '100%', height: 36, border: '1px solid #1e293b', borderRadius: 8, background: '#020617', cursor: 'pointer', padding: 2 }}
          />
        </Field>
      )}
    </>
  );
}

function SliderForm({ settings, set, deviceId }) {
  return (
    <>
      <Field label="Title">
        <TextInput value={settings.title} onChange={v => set('title', v)} placeholder="e.g. Fan Speed" />
      </Field>
      <Field label="Datastream">
        <DatastreamSelect deviceId={deviceId} value={settings.datastreamId} onChange={v => set('datastreamId', v)} />
      </Field>
      <ToggleRow
        label="Send values on release only"
        desc="Reduces network traffic during drag"
        checked={!!settings.sendOnReleaseOnly}
        onChange={v => set('sendOnReleaseOnly', v)}
      />
      <Field label="Handle Step">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STEP_PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => set('handleStep', p)}
              style={{
                padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                fontFamily: 'monospace', border: '1px solid',
                background: (settings.handleStep ?? 1) === p ? '#0c2a3f' : '#0f172a',
                borderColor: (settings.handleStep ?? 1) === p ? '#0369a1' : '#1e293b',
                color: (settings.handleStep ?? 1) === p ? '#38bdf8' : '#475569',
              }}
            >{p}</button>
          ))}
        </div>
      </Field>
      <ToggleRow
        label="Show fine controls"
        desc="Add ± precision buttons beside slider"
        checked={!!settings.showFineControls}
        onChange={v => set('showFineControls', v)}
      />
      <Field label="Value Position">
        <SegmentedControl
          value={settings.valuePosition ?? 'right'}
          options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
          onChange={v => set('valuePosition', v)}
        />
      </Field>
    </>
  );
}

function SwitchForm({ settings, set, deviceId }) {
  return (
    <>
      <Field label="Title">
        <TextInput value={settings.title} onChange={v => set('title', v)} placeholder="e.g. Pump Control" />
      </Field>
      <Field label="Datastream">
        <DatastreamSelect deviceId={deviceId} value={settings.datastreamId} onChange={v => set('datastreamId', v)} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="ON Value"><TextInput value={settings.onValue ?? '1'} onChange={v => set('onValue', v)} placeholder="1" /></Field>
        <Field label="OFF Value"><TextInput value={settings.offValue ?? '0'} onChange={v => set('offValue', v)} placeholder="0" /></Field>
      </div>
      <ToggleRow
        label="Show ON/OFF labels"
        desc="Display text beside the toggle"
        checked={!!settings.showLabels}
        onChange={v => set('showLabels', v)}
      />
      {settings.showLabels && (
        <div style={{ paddingLeft: 12, borderLeft: '2px solid #1e293b' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <Field label="ON Label"><TextInput value={settings.onLabel ?? 'ON'} onChange={v => set('onLabel', v)} /></Field>
            <Field label="OFF Label"><TextInput value={settings.offLabel ?? 'OFF'} onChange={v => set('offLabel', v)} /></Field>
          </div>
          <Field label="Label Position">
            <SegmentedControl
              value={settings.labelPosition ?? 'right'}
              options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
              onChange={v => set('labelPosition', v)}
            />
          </Field>
        </div>
      )}
      <ToggleRow
        label="Hide widget name"
        desc="Conceal title label on dashboard"
        checked={!!settings.hideTitle}
        onChange={v => set('hideTitle', v)}
      />
      <Field label="Switch Color">
        <input
          type="color"
          value={settings.color ?? '#0ea5e9'}
          onChange={e => set('color', e.target.value)}
          style={{ width: '100%', height: 36, border: '1px solid #1e293b', borderRadius: 8, background: '#020617', cursor: 'pointer', padding: 2 }}
        />
      </Field>
    </>
  );
}

function GenericForm({ settings, set, type }) {
  return (
    <>
      <Field label="Title">
        <TextInput value={settings.title ?? ''} onChange={v => set('title', v)} placeholder={`${type} title`} />
      </Field>
      <div style={{ fontSize: 12, color: '#334155' }}>
        Advanced settings for <code style={{ color: '#38bdf8' }}>{type}</code> are configured directly on the live dashboard.
      </div>
    </>
  );
}

// ── Type labels / icons ───────────────────────────────────────────────────────
const TYPE_META = {
  gauge: '🎯 Gauge', slider: '🎚 Slider', switch: '🔘 Switch',
  linechart: '📈 Line Chart', led: '💡 LED Indicator',
  button: '🟦 Push Button', progressbar: '📊 Progress Bar',
};

// ── Main modal (rendered via portal so it sits outside RGL's event tree) ───────
export default function WidgetSettingsModal({ widget, deviceId, onClose, onSave }) {
  const [settings, setSettings] = useState(() => ({ ...widget.settings }));
  const [jsonOpen, setJsonOpen] = useState(false);

  function set(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave({ ...widget, settings });
  }

  // Prevent scroll on body while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const modal = (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)' }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16,
          width: '100%', maxWidth: 440, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', marginBottom: 2 }}>WIDGET SETTINGS</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
              {TYPE_META[widget.type] ?? widget.type}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, background: '#1e293b', border: 'none', borderRadius: 8, color: '#64748b', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>

        {/* Scrollable form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {widget.type === 'gauge'  && <GaugeForm  settings={settings} set={set} deviceId={deviceId} />}
          {widget.type === 'slider' && <SliderForm settings={settings} set={set} deviceId={deviceId} />}
          {widget.type === 'switch' && <SwitchForm settings={settings} set={set} deviceId={deviceId} />}
          {!['gauge', 'slider', 'switch'].includes(widget.type) && (
            <GenericForm settings={settings} set={set} type={widget.type} />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          {/* JSON preview (collapsible) */}
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setJsonOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', padding: 0 }}
            >
              {jsonOpen ? '▼' : '▶'} settings_json preview
            </button>
            {jsonOpen && (
              <pre style={{
                marginTop: 6, padding: '8px 10px', background: '#020617', borderRadius: 6,
                fontSize: 10, color: '#22c55e', fontFamily: 'monospace', overflow: 'auto', maxHeight: 120,
              }}>
                {JSON.stringify(settings, null, 2)}
              </pre>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{ padding: '8px 20px', background: '#0284c7', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              ✓ Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
