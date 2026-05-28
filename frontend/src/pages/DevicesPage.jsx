import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const s = {
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:      { fontSize: 22, fontWeight: 700 },
  btn:        { background: '#0ea5e9', border: 'none', borderRadius: 6, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontWeight: 600 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 },
  card:       { background: '#1e293b', borderRadius: 10, padding: 20 },
  deviceName: { fontWeight: 600, fontSize: 16, marginBottom: 4 },
  badge:      { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 },
  online:     { background: '#14532d', color: '#4ade80' },
  offline:    { background: '#3b1515', color: '#f87171' },
  apiKey:     { fontFamily: 'monospace', fontSize: 11, color: '#64748b', wordBreak: 'break-all', marginTop: 8 },
  modal:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99 },
  mcard:      { background: '#1e293b', padding: 28, borderRadius: 12, width: 340 },
  label:      { display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  input:      { width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' },
};

export default function DevicesPage() {
  const { token } = useAuth();
  const [devices,   setDevices]   = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState({ name: '', device_type: 'esp32', description: '' });
  const socketRef = useRef(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = io({ auth: { token } });
    socketRef.current = socket;

    socket.on('device_status', ({ device_id, is_online }) => {
      setDevices(prev => prev.map(d =>
        d.id === device_id ? { ...d, is_online: is_online ? 1 : 0 } : d
      ));
    });

    return () => socket.disconnect();
  }, [token]);

  async function fetchDevices() {
    const { data } = await api.get('/device/list');
    setDevices(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    await api.post('/device/register', form);
    setShowModal(false);
    setForm({ name: '', device_type: 'esp32', description: '' });
    fetchDevices();
  }

  return (
    <div>
      <div style={s.header}>
        <div style={s.title}>My Devices</div>
        <button style={s.btn} onClick={() => setShowModal(true)}>+ Add Device</button>
      </div>

      <div style={s.grid}>
        {devices.map(d => (
          <div key={d.id} style={s.card}>
            <div style={s.deviceName}>{d.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{d.device_type}</div>
            <span style={{ ...s.badge, ...(d.is_online ? s.online : s.offline) }}>
              {d.is_online ? '● Online' : '○ Offline'}
            </span>
            <div style={s.apiKey}>API Key: {d.api_key}</div>
            {d.last_seen && (
              <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                Last seen: {new Date(d.last_seen).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}
              </div>
            )}
          </div>
        ))}
        {!devices.length && <div style={{ color: '#475569' }}>No devices yet. Add one to get started.</div>}
      </div>

      {showModal && (
        <div style={s.modal} onClick={() => setShowModal(false)}>
          <div style={s.mcard} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, marginBottom: 16 }}>Add Device</div>
            <form onSubmit={handleCreate}>
              <label style={s.label}>Name</label>
              <input style={s.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <label style={s.label}>Type</label>
              <select style={s.input} value={form.device_type} onChange={e => setForm(f => ({ ...f, device_type: e.target.value }))}>
                <option value="esp32">ESP32</option>
                <option value="esp8266">ESP8266</option>
                <option value="raspberry_pi">Raspberry Pi</option>
                <option value="generic">Generic</option>
              </select>
              <label style={s.label}>Description</label>
              <input style={s.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <button style={{ ...s.btn, width: '100%' }} type="submit">Create Device</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
