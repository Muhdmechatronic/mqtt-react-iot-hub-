import React, { useEffect, useState } from 'react';
import api from '../services/api';
import SwitchWidgetSettings, { buildSwitchSettings } from './SwitchWidgetSettings';

// ── Type catalogue ──────────────────────────────────────────────────────────
const TYPES = [
  { key: 'linechart',   label: 'Live Chart',    icon: '📈', defaultW: 6, defaultH: 4 },
  { key: 'gauge',       label: 'Gauge',         icon: '🎯', defaultW: 3, defaultH: 3 },
  { key: 'label',       label: 'Value Display', icon: '🔢', defaultW: 3, defaultH: 2 },
  { key: 'progressbar', label: 'Progress Bar',  icon: '📊', defaultW: 4, defaultH: 2 },
  { key: 'led',         label: 'LED Indicator', icon: '💡', defaultW: 2, defaultH: 2 },
  { key: 'switch',      label: 'Toggle',        icon: '🔘', defaultW: 2, defaultH: 2 },
  { key: 'slider',      label: 'Slider',        icon: '🎚', defaultW: 4, defaultH: 2 },
  { key: 'button',      label: 'Push Button',   icon: '🔲', defaultW: 2, defaultH: 2 },
];

const UNIT_HINTS = [
  '°C','°F','%','hPa','Pa','lux','ppm',
  'V','mV','A','mA','W','kW','kWh',
  'm','cm','mm','km','kg','g',
  'm/s','km/h','rpm','pH','dB',
];

const HAS_RANGE   = new Set(['gauge','slider','progressbar']);
const HAS_COMMAND = new Set(['switch','slider','button']);
const HAS_SENSOR  = new Set(['linechart','gauge','label','progressbar','led']);
const HAS_UNIT    = new Set(['linechart','gauge','label','progressbar','slider']);

// ── Styles ───────────────────────────────────────────────────────────────────
const s = {
  overlay:  { position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 },
  modal:    { background:'#1e293b', borderRadius:14, width:440, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.5)' },
  header:   { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px 0' },
  htitle:   { fontSize:16, fontWeight:700, color:'#e2e8f0' },
  closeBtn: { background:'none', border:'none', color:'#64748b', fontSize:20, cursor:'pointer', lineHeight:1 },
  body:     { padding:'16px 24px 24px' },
  section:  { marginBottom:16 },
  lbl:      { display:'block', fontSize:12, color:'#64748b', marginBottom:4, textTransform:'uppercase', letterSpacing:'.5px' },
  input:    { width:'100%', padding:'9px 12px', background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#e2e8f0', fontSize:14, boxSizing:'border-box' },
  row2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  typeGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7, marginTop:6 },
  typeCard: { border:'2px solid #334155', borderRadius:8, padding:'10px 6px', textAlign:'center', cursor:'pointer', transition:'all .15s', background:'#0f172a' },
  typeCardA:{ border:'2px solid #0ea5e9', background:'#0c1a2e' },
  typeIcon: { fontSize:22, lineHeight:1, marginBottom:4 },
  typeLbl:  { fontSize:11, color:'#94a3b8' },
  divider:  { borderTop:'1px solid #1e3a5f', margin:'16px 0' },
  footer:   { display:'flex', gap:10, justifyContent:'flex-end' },
  btnCancel:{ background:'none', border:'1px solid #334155', borderRadius:6, color:'#94a3b8', padding:'9px 20px', cursor:'pointer', fontSize:13 },
  btnSave:  { background:'#0ea5e9', border:'none', borderRadius:6, color:'#fff', padding:'9px 22px', cursor:'pointer', fontWeight:700, fontSize:13 },
  colorRow: { display:'flex', alignItems:'center', gap:10 },
  colorPick:{ width:36, height:36, borderRadius:6, border:'1px solid #334155', cursor:'pointer', padding:2 },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function emptyForm(type = 'gauge') {
  return {
    type,
    title:              '',
    device_id:          '',
    datastream_id:      '',
    data_key:           '',
    unit:               '',
    color:              '#38bdf8',
    min:                '0',
    max:                '100',
    threshold:          '0.5',
    command:            '',
    buttonLabel:        '',
    // switch-specific
    sw_on_value:        '1',
    sw_off_value:       '0',
    sw_show_labels:     false,
    sw_on_label:        'ON',
    sw_off_label:       'OFF',
    sw_label_position:  'right',
    sw_hide_title:      false,
  };
}

function widgetToForm(w) {
  const sj = w.settings_json || {};
  return {
    type:               w.type,
    title:              w.title             || '',
    device_id:          String(w.device_id  || ''),
    datastream_id:      String(w.datastream_id || ''),
    data_key:           w.data_key          || '',
    unit:               sj.unit             ?? '',
    color:              sj.color            ?? '#38bdf8',
    min:                String(sj.min       ?? 0),
    max:                String(sj.max       ?? 100),
    threshold:          String(sj.threshold ?? 0.5),
    command:            sj.command          ?? '',
    buttonLabel:        sj.label            ?? '',
    // switch-specific
    sw_on_value:        sj.on_value         ?? '1',
    sw_off_value:       sj.off_value        ?? '0',
    sw_show_labels:     sj.show_labels      ?? false,
    sw_on_label:        sj.on_label         ?? 'ON',
    sw_off_label:       sj.off_label        ?? 'OFF',
    sw_label_position:  sj.label_position   ?? 'right',
    sw_hide_title:      sj.hide_title       ?? false,
  };
}

function buildSettings(form) {
  if (form.type === 'switch') return buildSwitchSettings(form);

  const base = { color: form.color };
  if (form.unit && HAS_UNIT.has(form.type)) base.unit = form.unit;
  if (HAS_RANGE.has(form.type)) {
    base.min = parseFloat(form.min) || 0;
    base.max = parseFloat(form.max) || 100;
  }
  if (form.type === 'led') base.threshold = parseFloat(form.threshold) || 0.5;
  if (HAS_COMMAND.has(form.type) && form.command) base.command = form.command;
  if (form.type === 'button' && form.buttonLabel) base.label = form.buttonLabel;
  return base;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WidgetModal({ dashboardId, widget, onClose, onSaved }) {
  const isEdit = Boolean(widget);
  const [form, setForm]               = useState(isEdit ? widgetToForm(widget) : emptyForm());
  const [devices, setDevices]         = useState([]);
  const [sensorTypes, setSensorTypes] = useState([]);
  const [saving, setSaving]           = useState(false);

  // Load devices
  useEffect(() => {
    api.get('/device/list').then(r => setDevices(r.data)).catch(() => {});
  }, []);

  // Load sensor types when device changes
  useEffect(() => {
    if (!form.device_id) { setSensorTypes([]); return; }
    api.get('/sensor/types', { params: { device_id: form.device_id } })
      .then(r => setSensorTypes(r.data))
      .catch(() => setSensorTypes([]));
  }, [form.device_id]);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }
  function onChange(e)   { set(e.target.name, e.target.value); }

  function pickType(key) {
    setForm(f => ({ ...emptyForm(key), title: f.title, device_id: f.device_id, data_key: f.data_key }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return alert('Title is required');
    setSaving(true);
    try {
      const payload = {
        type:          form.type,
        title:         form.title.trim(),
        device_id:     form.device_id     ? parseInt(form.device_id)     : null,
        datastream_id: form.datastream_id ? parseInt(form.datastream_id) : null,
        data_key:      HAS_SENSOR.has(form.type) && form.type !== 'switch' ? form.data_key || null : null,
        settings:      buildSettings(form),
      };

      if (isEdit) {
        await api.put(`/dashboard/widgets/${widget.id}`, payload);
      } else {
        const { defaultW, defaultH } = TYPES.find(t => t.key === form.type) || {};
        await api.post(`/dashboard/${dashboardId}/widgets`, {
          ...payload,
          x: 0, y: 0,
          w: defaultW ?? 3,
          h: defaultH ?? 3,
        });
      }
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save widget');
    } finally {
      setSaving(false);
    }
  }

  const showSensor    = HAS_SENSOR.has(form.type);
  const showRange     = HAS_RANGE.has(form.type);
  const showCommand   = HAS_COMMAND.has(form.type);
  const showUnit      = HAS_UNIT.has(form.type);
  const showThreshold = form.type === 'led';

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.htitle}>{isEdit ? 'Edit Widget' : 'Add Widget'}</div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <form style={s.body} onSubmit={handleSubmit}>
          {/* ── Type picker ── */}
          <div style={s.section}>
            <label style={s.lbl}>Widget Type</label>
            <div style={s.typeGrid}>
              {TYPES.map(t => (
                <div
                  key={t.key}
                  style={{ ...s.typeCard, ...(form.type === t.key ? s.typeCardA : {}) }}
                  onClick={() => pickType(t.key)}
                >
                  <div style={s.typeIcon}>{t.icon}</div>
                  <div style={{ ...s.typeLbl, color: form.type === t.key ? '#38bdf8' : '#94a3b8' }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Switch: dedicated settings panel ── */}
          {form.type === 'switch' && (
            <>
              <div style={s.divider} />
              <SwitchWidgetSettings form={form} set={set} devices={devices} />
              <div style={s.divider} />
              <div style={s.footer}>
                <button type="button" style={s.btnCancel} onClick={onClose}>Cancel</button>
                <button type="submit" style={s.btnSave} disabled={saving}>
                  {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Widget'}
                </button>
              </div>
            </>
          )}

          {/* ── All other types: generic fields ── */}
          {form.type !== 'switch' && (<>

          {/* ── Title ── */}
          <div style={s.section}>
            <label style={s.lbl}>Title</label>
            <input name="title" style={s.input} value={form.title} onChange={onChange} required placeholder="Widget title" />
          </div>

          {/* ── Device + sensor ── */}
          <div style={s.section}>
            <div style={s.row2}>
              <div>
                <label style={s.lbl}>Device</label>
                <select name="device_id" style={s.input} value={form.device_id} onChange={onChange}>
                  <option value="">-- none --</option>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {showSensor && (
                <div>
                  <label style={s.lbl}>Sensor</label>
                  <select name="data_key" style={s.input} value={form.data_key} onChange={onChange} disabled={!form.device_id}>
                    <option value="">-- select --</option>
                    {sensorTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div style={s.divider} />

          {/* ── Unit + Color ── */}
          <div style={s.section}>
            <div style={s.row2}>
              {showUnit && (
                <div>
                  <label style={s.lbl}>Unit</label>
                  <input
                    name="unit"
                    list="wm-units"
                    style={s.input}
                    value={form.unit}
                    onChange={onChange}
                    placeholder="e.g. °C"
                  />
                  <datalist id="wm-units">
                    {UNIT_HINTS.map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
              )}
              <div>
                <label style={s.lbl}>Color</label>
                <div style={s.colorRow}>
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => set('color', e.target.value)}
                    style={s.colorPick}
                  />
                  <span style={{ color:'#94a3b8', fontSize:13 }}>{form.color}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── LED threshold ── */}
          {showThreshold && (
            <div style={s.section}>
              <label style={s.lbl}>ON Threshold (value ≥ this → LED ON)</label>
              <input name="threshold" type="number" step="any" style={s.input} value={form.threshold} onChange={onChange} />
            </div>
          )}

          {/* ── Range (gauge / slider) ── */}
          {showRange && (
            <div style={s.section}>
              <div style={s.row2}>
                <div>
                  <label style={s.lbl}>Min</label>
                  <input name="min" type="number" style={s.input} value={form.min} onChange={onChange} />
                </div>
                <div>
                  <label style={s.lbl}>Max</label>
                  <input name="max" type="number" style={s.input} value={form.max} onChange={onChange} />
                </div>
              </div>
            </div>
          )}

          {/* ── Command (switch / slider / button) ── */}
          {showCommand && (
            <div style={s.section}>
              <label style={s.lbl}>Command name</label>
              <input
                name="command"
                style={s.input}
                value={form.command}
                onChange={onChange}
                placeholder={form.type === 'switch' ? 'relay' : form.type === 'slider' ? 'pwm' : 'toggle'}
              />
              {form.type === 'button' && (
                <>
                  <label style={{ ...s.lbl, marginTop: 10 }}>Button label</label>
                  <input name="buttonLabel" style={s.input} value={form.buttonLabel} onChange={onChange} placeholder={form.title || 'Press'} />
                </>
              )}
            </div>
          )}

          <div style={s.divider} />

          <div style={s.footer}>
            <button type="button" style={s.btnCancel} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.btnSave} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Widget'}
            </button>
          </div>
          </>)}
        </form>
      </div>
    </div>
  );
}
