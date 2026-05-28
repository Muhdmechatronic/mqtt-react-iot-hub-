import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

// ── Unit groups ───────────────────────────────────────────────────────────────
const UNIT_GROUPS = [
  { label: 'None',          units: ['(none)'] },
  { label: 'Temperature',   units: ['°C', '°F', 'K'] },
  { label: 'Distance',      units: ['m', 'cm', 'mm', 'km', 'mi', 'yd', 'ft', 'in'] },
  { label: 'Speed',         units: ['m/s', 'km/h', 'mph', 'knots'] },
  { label: 'Area',          units: ['m²', 'cm²', 'km²', 'ft²'] },
  { label: 'Volume',        units: ['L', 'mL', 'm³', 'gal'] },
  { label: 'Pressure',      units: ['Pa', 'hPa', 'kPa', 'bar', 'psi', 'atm'] },
  { label: 'Power',         units: ['W', 'kW', 'MW', 'hp'] },
  { label: 'Energy',        units: ['J', 'kJ', 'Wh', 'kWh', 'MWh'] },
  { label: 'Current',       units: ['A', 'mA', 'μA'] },
  { label: 'Voltage',       units: ['V', 'mV', 'kV'] },
  { label: 'Resistance',    units: ['Ω', 'kΩ', 'MΩ'] },
  { label: 'Frequency',     units: ['Hz', 'kHz', 'MHz', 'GHz'] },
  { label: 'Data',          units: ['bit', 'B', 'KB', 'MB', 'GB'] },
  { label: 'Percentage',    units: ['%', '%RH'] },
  { label: 'Concentration', units: ['ppm', 'ppb', 'mg/m³', 'μg/m³'] },
  { label: 'Mass',          units: ['kg', 'g', 'mg', 'lb', 'oz', 't'] },
  { label: 'Time',          units: ['s', 'ms', 'min', 'h', 'day'] },
  { label: 'Light',         units: ['lux', 'lm', 'cd/m²'] },
  { label: 'Angle',         units: ['°', 'rad'] },
  { label: 'Other',         units: ['pH', 'dB', 'pcs', 'pulses'] },
];

const DATA_TYPES = ['integer', 'double', 'string'];

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:      { color: '#e2e8f0' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:     { fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  subtitle:  { fontSize: 13, color: '#64748b', marginTop: 2 },
  toolbar:   { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  select:    { padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none' },
  btnPrimary:{ background: '#0ea5e9', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { padding: '10px 14px', background: '#0f172a', color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', textAlign: 'left', borderBottom: '1px solid #1e293b' },
  td:        { padding: '12px 14px', borderBottom: '1px solid #1e293b', fontSize: 13, verticalAlign: 'middle' },
  pin:       { display: 'inline-block', background: '#0c1a2e', border: '1px solid #1e3a5f', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' },
  typeBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 },
  actionBtn: { background: 'none', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', padding: '5px 10px', cursor: 'pointer', fontSize: 12 },
  delBtn:    { background: 'none', border: '1px solid #ef444455', borderRadius: 6, color: '#ef4444', padding: '5px 10px', cursor: 'pointer', fontSize: 12 },
  emptyRow:  { textAlign: 'center', padding: 48, color: '#475569', fontSize: 14 },

  // Modal
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  modal:     { background: '#1e293b', borderRadius: 14, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.6)' },
  mHead:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px 0' },
  mTitle:    { fontSize: 16, fontWeight: 700, color: '#f1f5f9' },
  closeBtn:  { background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', lineHeight: 1 },
  mBody:     { padding: '18px 24px 24px' },
  label:     { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' },
  input:     { width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  inputDis:  { width: '100%', padding: '9px 12px', background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 8, color: '#334155', fontSize: 14, boxSizing: 'border-box' },
  row2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  row3:      { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  divider:   { borderTop: '1px solid #1e3a5f', margin: '18px 0' },
  mFooter:   { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  btnCancel: { background: 'none', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '9px 20px', cursor: 'pointer', fontSize: 13 },
  btnSave:   { background: '#0ea5e9', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 22px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  errTxt:    { color: '#ef4444', fontSize: 12, marginTop: 6 },
  section:   { marginBottom: 16 },
};

const TYPE_COLORS = {
  integer: { background: '#0c2d4a', color: '#38bdf8' },
  double:  { background: '#0c2d2a', color: '#34d399' },
  string:  { background: '#2d1e0a', color: '#f59e0b' },
};

// Virtual pins V0..V255
const PIN_OPTIONS = Array.from({ length: 256 }, (_, i) => i);

const ACCESS_TYPES = ['READ_WRITE', 'READ_ONLY', 'WRITE_ONLY'];

const ACCESS_COLORS = {
  READ_WRITE: { background: '#0c2d4a', color: '#38bdf8' },
  READ_ONLY:  { background: '#0c2a1f', color: '#34d399' },
  WRITE_ONLY: { background: '#2d1e0a', color: '#f59e0b' },
};

function emptyForm() {
  return {
    virtual_pin:   '0',
    name:          '',
    display_name:  '',
    data_type:     'double',
    access_type:   'READ_WRITE',
    unit:          '(none)',
    min_value:     '',
    max_value:     '',
    default_value: '',
  };
}

// ── Datastream Modal ──────────────────────────────────────────────────────────
function DatastreamModal({ deviceId, existing, takenPins, onClose, onSaved }) {
  const isEdit  = Boolean(existing);
  const [form,  setForm]  = useState(isEdit ? {
    virtual_pin:   String(existing.virtual_pin),
    name:          existing.name,
    display_name:  existing.display_name,
    data_type:     existing.data_type,
    access_type:   existing.access_type || 'READ_WRITE',
    unit:          existing.unit || '(none)',
    min_value:     existing.min_value !== null ? String(existing.min_value) : '',
    max_value:     existing.max_value !== null ? String(existing.max_value) : '',
    default_value: existing.default_value || '',
  } : emptyForm());

  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function onChange(e) { set(e.target.name, e.target.value); }

  const isString = form.data_type === 'string';

  // Validate on the fly
  function validate() {
    const pin = parseInt(form.virtual_pin);
    if (!form.name.trim())         return 'Name is required';
    if (!form.display_name.trim()) return 'Display Name is required';
    if (!isEdit && takenPins.has(pin)) return `V${pin} is already in use on this device`;
    if (!isString) {
      const min = parseFloat(form.min_value);
      const max = parseFloat(form.max_value);
      if (form.min_value !== '' && form.max_value !== '' && !isNaN(min) && !isNaN(max) && min >= max) {
        return 'Max must be greater than Min';
      }
    }
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);

    const payload = {
      device_id:     deviceId,
      virtual_pin:   parseInt(form.virtual_pin),
      name:          form.name.trim(),
      display_name:  form.display_name.trim(),
      data_type:     form.data_type,
      access_type:   form.access_type,
      unit:          form.unit === '(none)' ? null : form.unit,
      min_value:     isString ? null : (form.min_value === '' ? null : form.min_value),
      max_value:     isString ? null : (form.max_value === '' ? null : form.max_value),
      default_value: form.default_value || null,
    };

    try {
      if (isEdit) {
        await api.put(`/datastream/${existing.id}`, payload);
      } else {
        await api.post('/datastream', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.mHead}>
          <div style={s.mTitle}>{isEdit ? 'Edit Datastream' : 'New Datastream'}</div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <form style={s.mBody} onSubmit={submit}>
          {/* Virtual Pin */}
          <div style={s.section}>
            <label style={s.label}>Virtual Pin</label>
            <select name="virtual_pin" style={s.select} value={form.virtual_pin} onChange={onChange}>
              {PIN_OPTIONS.map(p => (
                <option key={p} value={p} disabled={!isEdit && takenPins.has(p)}>
                  V{p}{!isEdit && takenPins.has(p) ? ' (in use)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Name + Display Name */}
          <div style={{ ...s.section, ...s.row2 }}>
            <div>
              <label style={s.label}>Name <span style={{ color: '#334155' }}>(identifier)</span></label>
              <input
                name="name"
                style={s.input}
                value={form.name}
                onChange={onChange}
                placeholder="e.g. temperature"
                pattern="[a-zA-Z0-9_]+"
                title="Letters, numbers and underscore only"
                required
              />
            </div>
            <div>
              <label style={s.label}>Display Name</label>
              <input
                name="display_name"
                style={s.input}
                value={form.display_name}
                onChange={onChange}
                placeholder="e.g. Room Temp"
                required
              />
            </div>
          </div>

          <div style={s.divider} />

          {/* Data Type + Access Type + Unit */}
          <div style={{ ...s.section, ...s.row3 }}>
            <div>
              <label style={s.label}>Data Type</label>
              <select name="data_type" style={s.select} value={form.data_type} onChange={onChange}>
                {DATA_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Access Type</label>
              <select name="access_type" style={s.select} value={form.access_type} onChange={onChange}>
                {ACCESS_TYPES.map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Unit</label>
              <select
                name="unit"
                style={{ ...s.select, opacity: isString ? 0.4 : 1 }}
                value={form.unit}
                onChange={onChange}
                disabled={isString}
              >
                {UNIT_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.units.map(u => <option key={u} value={u}>{u}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div style={s.divider} />

          {/* Min / Max / Default */}
          <div style={{ ...s.section, ...s.row3 }}>
            <div>
              <label style={s.label}>Min</label>
              <input
                name="min_value"
                type="number"
                step="any"
                style={isString ? s.inputDis : s.input}
                value={form.min_value}
                onChange={onChange}
                disabled={isString}
                placeholder={isString ? '—' : '0'}
              />
            </div>
            <div>
              <label style={s.label}>Max</label>
              <input
                name="max_value"
                type="number"
                step="any"
                style={isString ? s.inputDis : s.input}
                value={form.max_value}
                onChange={onChange}
                disabled={isString}
                placeholder={isString ? '—' : '100'}
              />
            </div>
            <div>
              <label style={s.label}>Default Value</label>
              <input
                name="default_value"
                style={s.input}
                value={form.default_value}
                onChange={onChange}
                placeholder={isString ? 'text…' : form.min_value || '0'}
              />
            </div>
          </div>

          {error && <div style={s.errTxt}>{error}</div>}

          <div style={{ ...s.divider, marginTop: 12 }} />
          <div style={s.mFooter}>
            <button type="button" style={s.btnCancel} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.btnSave} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Datastream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DatastreamPage() {
  const [devices,     setDevices]     = useState([]);
  const [deviceId,    setDeviceId]    = useState('');
  const [streams,     setStreams]     = useState([]);
  const [showModal,   setShowModal]   = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    api.get('/device/list').then(r => {
      setDevices(r.data);
      if (r.data.length > 0) setDeviceId(String(r.data[0].id));
    }).catch(() => {});
  }, []);

  const loadStreams = useCallback(() => {
    if (!deviceId) return;
    setLoading(true);
    api.get('/datastream', { params: { device_id: deviceId } })
      .then(r => setStreams(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [deviceId]);

  useEffect(() => { loadStreams(); }, [loadStreams]);

  function openCreate() { setEditTarget(null); setShowModal(true); }
  function openEdit(ds) { setEditTarget(ds);   setShowModal(true); }

  async function handleDelete(ds) {
    if (!window.confirm(`Delete V${ds.virtual_pin} · ${ds.display_name}?`)) return;
    try {
      await api.delete(`/datastream/${ds.id}`);
      setStreams(prev => prev.filter(s => s.id !== ds.id));
    } catch {
      alert('Delete failed');
    }
  }

  function onSaved() { setShowModal(false); setEditTarget(null); loadStreams(); }

  const takenPins = new Set(streams.map(s => s.virtual_pin));

  const selectedDevice = devices.find(d => String(d.id) === deviceId);

  return (
    <div style={s.page}>
      {/* Page header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>Datastreams</div>
          <div style={s.subtitle}>Virtual pin management — V0 to V255</div>
        </div>
        <button style={s.btnPrimary} onClick={openCreate} disabled={!deviceId}>
          + New Datastream
        </button>
      </div>

      {/* Device selector */}
      <div style={s.toolbar}>
        <span style={{ fontSize: 13, color: '#64748b' }}>Device:</span>
        <select
          style={s.select}
          value={deviceId}
          onChange={e => setDeviceId(e.target.value)}
        >
          {devices.length === 0 && <option>No devices</option>}
          {devices.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {selectedDevice && (
          <span style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>
            key: {selectedDevice.api_key?.slice(0, 12)}…
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#334155' }}>
          {streams.length} / 256 pins used
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden', border: '1px solid #1e3a5f' }}>
        <table style={s.table}>
          <thead>
            <tr>
              {['V-Pin', 'Name', 'Display Name', 'Type', 'Access', 'Unit', 'Min', 'Max', 'Default', 'Actions'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} style={{ ...s.td, ...s.emptyRow }}>Loading…</td></tr>
            )}
            {!loading && streams.length === 0 && (
              <tr>
                <td colSpan={10} style={{ ...s.td, ...s.emptyRow }}>
                  No datastreams yet — click <strong style={{ color: '#38bdf8' }}>+ New Datastream</strong> to add one.
                </td>
              </tr>
            )}
            {!loading && streams.map(ds => (
              <tr key={ds.id} style={{ transition: 'background 0.1s' }}>
                <td style={s.td}>
                  <span style={s.pin}>V{ds.virtual_pin}</span>
                </td>
                <td style={{ ...s.td, fontFamily: 'monospace', color: '#94a3b8', fontSize: 12 }}>{ds.name}</td>
                <td style={{ ...s.td, color: '#e2e8f0', fontWeight: 500 }}>{ds.display_name}</td>
                <td style={s.td}>
                  <span style={{ ...s.typeBadge, ...TYPE_COLORS[ds.data_type] }}>
                    {ds.data_type}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.typeBadge, ...(ACCESS_COLORS[ds.access_type] || ACCESS_COLORS.READ_WRITE), fontSize: 10 }}>
                    {(ds.access_type || 'READ_WRITE').replace('_', ' ')}
                  </span>
                </td>
                <td style={{ ...s.td, color: '#64748b' }}>{ds.unit || '—'}</td>
                <td style={{ ...s.td, color: '#64748b', fontFamily: 'monospace' }}>
                  {ds.min_value !== null ? ds.min_value : '—'}
                </td>
                <td style={{ ...s.td, color: '#64748b', fontFamily: 'monospace' }}>
                  {ds.max_value !== null ? ds.max_value : '—'}
                </td>
                <td style={{ ...s.td, color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>
                  {ds.default_value || '—'}
                </td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={s.actionBtn} onClick={() => openEdit(ds)}>✏ Edit</button>
                    <button style={s.delBtn}    onClick={() => handleDelete(ds)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && deviceId && (
        <DatastreamModal
          deviceId={parseInt(deviceId)}
          existing={editTarget}
          takenPins={takenPins}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
