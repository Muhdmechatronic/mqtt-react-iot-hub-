/**
 * SwitchWidgetSettings
 *
 * Rendered inside WidgetModal when type === 'switch'.
 * Receives: form, set, devices, sensorTypes, onChange from WidgetModal.
 * Adds switch-specific fields on top of the base form state.
 *
 * Saved widget JSON shape:
 * {
 *   type: "switch",
 *   title: "Pump Control",
 *   device_id: 1,
 *   datastream_id: 5,          ← virtual pin link
 *   data_key: null,
 *   settings_json: {
 *     color:          "#22c55e",
 *     on_value:       "1",
 *     off_value:      "0",
 *     show_labels:    true,
 *     on_label:       "Running",
 *     off_label:      "Stopped",
 *     label_position: "right",
 *     hide_title:     false,
 *     command:        "relay"
 *   }
 * }
 */

import React, { useEffect, useState } from 'react';
import api from '../services/api';

// ── Mini toggle component ─────────────────────────────────────────────────────
function Toggle({ value, onChange, color = '#0ea5e9' }) {
  return (
    <div
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        display:    'inline-flex',
        width:      44, height: 24, borderRadius: 99,
        background: value ? color : '#1e293b',
        border:     `2px solid ${value ? color : '#334155'}`,
        cursor:     'pointer', position: 'relative', flexShrink: 0,
        transition: 'background 0.2s, border-color 0.2s',
        boxShadow:  value ? `0 0 8px ${color}66` : 'none',
      }}
    >
      <div style={{
        position:   'absolute', top: 2, left: value ? 22 : 2,
        width:      16, height: 16, borderRadius: '50%',
        background: '#fff',
        boxShadow:  '0 1px 4px rgba(0,0,0,.3)',
        transition: 'left 0.2s cubic-bezier(.34,1.56,.64,1)',
      }} />
    </div>
  );
}

// ── Segmented control ─────────────────────────────────────────────────────────
function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: '#0f172a', borderRadius: 8, padding: 3, border: '1px solid #1e293b' }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            background:   value === o.value ? '#1e3a5f' : 'none',
            border:       'none',
            borderRadius: 6,
            color:        value === o.value ? '#38bdf8' : '#64748b',
            padding:      '5px 14px',
            cursor:       'pointer',
            fontSize:     12,
            fontWeight:   value === o.value ? 700 : 400,
            transition:   'all 0.15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  section:   { marginBottom: 20 },
  sLabel:    { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, fontWeight: 600 },
  field:     { marginBottom: 14 },
  label:     { display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 5 },
  input:     { width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box', outline: 'none' },
  select:    { width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none' },
  row2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  row2small: { display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12, alignItems: 'center' },
  toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1e293b' },
  toggleLbl: { fontSize: 13, color: '#e2e8f0' },
  toggleSub: { fontSize: 11, color: '#475569', marginTop: 2 },
  card:      { background: '#0f172a', borderRadius: 10, padding: '14px 16px', border: '1px solid #1e293b' },
  pinBadge:  { display: 'inline-block', background: '#0c2d4a', border: '1px solid #1e3a5f', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', marginLeft: 6 },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function SwitchWidgetSettings({ form, set, devices }) {
  const [datastreams, setDatastreams] = useState([]);

  // Load datastreams for the selected device
  useEffect(() => {
    if (!form.device_id) { setDatastreams([]); return; }
    api.get('/datastream', { params: { device_id: form.device_id } })
      .then(r => setDatastreams(r.data))
      .catch(() => setDatastreams([]));
  }, [form.device_id]);

  function sw(key, val) { set(key, val); }

  const selectedDs = datastreams.find(d => String(d.id) === String(form.datastream_id));
  const showLabels  = form.sw_show_labels ?? false;

  return (
    <div>
      {/* ── Widget Title ── */}
      <div style={s.section}>
        <div style={s.sLabel}>Widget</div>
        <div style={s.card}>
          <div style={s.field}>
            <label style={s.label}>Title <span style={{ color: '#334155' }}>(optional)</span></label>
            <input
              style={s.input}
              value={form.title}
              onChange={e => sw('title', e.target.value)}
              placeholder="e.g. Pump Control"
            />
          </div>
          {/* Hide title toggle */}
          <div style={s.toggleRow}>
            <div>
              <div style={s.toggleLbl}>Hide widget name</div>
              <div style={s.toggleSub}>Title bar not shown on dashboard</div>
            </div>
            <Toggle
              value={form.sw_hide_title ?? false}
              onChange={v => sw('sw_hide_title', v)}
            />
          </div>
        </div>
      </div>

      {/* ── Datastream ── */}
      <div style={s.section}>
        <div style={s.sLabel}>Datastream</div>
        <div style={s.card}>
          <div style={s.field}>
            <label style={s.label}>Device</label>
            <select
              style={s.select}
              value={form.device_id}
              onChange={e => { sw('device_id', e.target.value); sw('datastream_id', ''); }}
            >
              <option value="">— select device —</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>
              Virtual Pin / Datastream
              {selectedDs && <span style={s.pinBadge}>V{selectedDs.virtual_pin}</span>}
            </label>
            <select
              style={s.select}
              value={form.datastream_id || ''}
              onChange={e => sw('datastream_id', e.target.value)}
              disabled={!form.device_id}
            >
              <option value="">— select datastream —</option>
              {datastreams.map(d => (
                <option key={d.id} value={d.id}>
                  V{d.virtual_pin} · {d.display_name} ({d.data_type})
                </option>
              ))}
            </select>
            {form.device_id && datastreams.length === 0 && (
              <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>
                No datastreams for this device — create one on the Datastreams page.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Value Mapping ── */}
      <div style={s.section}>
        <div style={s.sLabel}>Value Mapping</div>
        <div style={s.card}>
          <div style={s.row2}>
            <div style={s.field}>
              <label style={s.label}>ON Value</label>
              <input
                style={s.input}
                value={form.sw_on_value ?? '1'}
                onChange={e => sw('sw_on_value', e.target.value)}
                placeholder="1"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>OFF Value</label>
              <input
                style={s.input}
                value={form.sw_off_value ?? '0'}
                onChange={e => sw('sw_off_value', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: -8 }}>
            Values sent to the virtual pin when the switch state changes.
          </div>
        </div>
      </div>

      {/* ── Labels ── */}
      <div style={s.section}>
        <div style={s.sLabel}>Labels</div>
        <div style={s.card}>
          <div style={s.toggleRow}>
            <div>
              <div style={s.toggleLbl}>Show ON / OFF labels</div>
              <div style={s.toggleSub}>Display text inside or beside the switch</div>
            </div>
            <Toggle
              value={showLabels}
              onChange={v => sw('sw_show_labels', v)}
              color="#22c55e"
            />
          </div>

          {showLabels && (
            <>
              <div style={{ ...s.row2, marginTop: 14 }}>
                <div style={s.field}>
                  <label style={s.label}>ON Label</label>
                  <input
                    style={s.input}
                    value={form.sw_on_label ?? 'ON'}
                    onChange={e => sw('sw_on_label', e.target.value)}
                    placeholder="Active, OPEN, Running…"
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>OFF Label</label>
                  <input
                    style={s.input}
                    value={form.sw_off_label ?? 'OFF'}
                    onChange={e => sw('sw_off_label', e.target.value)}
                    placeholder="Inactive, CLOSED…"
                  />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Label Position</label>
                <Segmented
                  options={[
                    { label: '← Left',  value: 'left'  },
                    { label: 'Right →', value: 'right' },
                  ]}
                  value={form.sw_label_position ?? 'right'}
                  onChange={v => sw('sw_label_position', v)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Color ── */}
      <div style={s.section}>
        <div style={s.sLabel}>Appearance</div>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <label style={s.label}>Switch Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={form.color ?? '#0ea5e9'}
                  onChange={e => sw('color', e.target.value)}
                  style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid #334155', cursor: 'pointer', padding: 2, background: '#0f172a' }}
                />
                <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{form.color ?? '#0ea5e9'}</span>
              </div>
            </div>
            {/* Live preview */}
            <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#334155', marginBottom: 6 }}>Preview</div>
              <div style={{
                display: 'inline-flex', width: 52, height: 28, borderRadius: 99,
                background: form.color ?? '#0ea5e9',
                border: `2px solid ${form.color ?? '#0ea5e9'}`,
                position: 'relative',
                boxShadow: `0 0 10px ${form.color ?? '#0ea5e9'}66`,
              }}>
                <div style={{
                  position: 'absolute', top: 3, left: 26,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── buildSwitchSettings() helper ─────────────────────────────────────────────
// Call this in WidgetModal when type === 'switch' to build settings_json.
export function buildSwitchSettings(form) {
  return {
    color:          form.color          ?? '#0ea5e9',
    on_value:       form.sw_on_value    ?? '1',
    off_value:      form.sw_off_value   ?? '0',
    show_labels:    form.sw_show_labels ?? false,
    on_label:       form.sw_on_label    ?? 'ON',
    off_label:      form.sw_off_label   ?? 'OFF',
    label_position: form.sw_label_position ?? 'right',
    hide_title:     form.sw_hide_title  ?? false,
    command:        form.command        ?? 'relay',
  };
}
