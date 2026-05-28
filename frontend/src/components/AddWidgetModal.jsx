import React, { useEffect, useState } from 'react';
import api from '../services/api';

const WIDGET_TYPES = ['button','switch','gauge','linechart','slider','label','status'];

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 },
  modal:   { background:'#1e293b', padding:28, borderRadius:12, width:380, maxHeight:'80vh', overflowY:'auto' },
  label:   { display:'block', fontSize:13, color:'#94a3b8', marginBottom:4 },
  input:   { width:'100%', padding:'9px 12px', background:'#0f172a', border:'1px solid #334155', borderRadius:6, color:'#e2e8f0', fontSize:14, marginBottom:14 },
  btn:     { background:'#0ea5e9', border:'none', borderRadius:6, color:'#fff', padding:'9px 20px', cursor:'pointer', fontWeight:600, width:'100%' },
};

export default function AddWidgetModal({ dashboardId, onClose, onAdded }) {
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({
    type:'gauge', title:'', device_id:'', data_key:'', x:0, y:0, w:3, h:3,
    settings: '{"min":0,"max":100,"unit":"","color":"#38bdf8"}'
  });

  useEffect(() => { api.get('/device/list').then(r => setDevices(r.data)); }, []);

  function onChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    let settings;
    try { settings = JSON.parse(form.settings); } catch { return alert('Invalid JSON in settings'); }
    await api.post(`/dashboard/${dashboardId}/widgets`, { ...form, settings });
    onAdded();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:700, marginBottom:16 }}>Add Widget</div>
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Widget Type</label>
          <select name="type" style={s.input} value={form.type} onChange={onChange}>
            {WIDGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label style={s.label}>Title</label>
          <input name="title" style={s.input} value={form.title} onChange={onChange} required />
          <label style={s.label}>Device</label>
          <select name="device_id" style={s.input} value={form.device_id} onChange={onChange}>
            <option value="">-- none --</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label style={s.label}>Data Key (sensor_type)</label>
          <input name="data_key" style={s.input} value={form.data_key} onChange={onChange} placeholder="e.g. temperature" />
          <label style={s.label}>Settings JSON</label>
          <textarea name="settings" style={{ ...s.input, height:80, resize:'vertical', fontFamily:'monospace' }}
            value={form.settings} onChange={onChange} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
            {['x','y','w','h'].map(k => (
              <div key={k}>
                <label style={s.label}>{k.toUpperCase()}</label>
                <input name={k} type="number" style={s.input} value={form[k]} onChange={onChange} min={0} />
              </div>
            ))}
          </div>
          <button style={s.btn} type="submit">Add Widget</button>
        </form>
      </div>
    </div>
  );
}
