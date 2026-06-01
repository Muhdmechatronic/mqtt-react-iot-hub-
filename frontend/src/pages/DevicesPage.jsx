import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Radio, Plus, X, Wifi, WifiOff, Cpu, CircuitBoard, Key, Trash2, Loader2 } from 'lucide-react';

const DEVICE_TYPE_ICONS = {
  esp32:        <Cpu size={14} />,
  esp8266:      <Cpu size={14} />,
  raspberry_pi: <CircuitBoard size={14} />,
  generic:      <Radio size={14} />,
};

/* ── Confirm delete dialog ───────────────────────────────────────────────── */
function DeleteConfirmDialog({ device, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Delete Device</h2>
            <p className="text-xs text-slate-500 mt-0.5">This cannot be undone</p>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 mb-5">
          <p className="text-sm text-slate-300 font-medium">{device.name}</p>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">{device.device_type?.replace('_', ' ')}</p>
        </div>

        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Deleting this device will also remove all its sensor data, datastreams, and dashboard widget bindings.
        </p>

        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-400 disabled:opacity-60 transition-all shadow-lg shadow-red-500/20">
            {loading
              ? <><Loader2 size={14} className="animate-spin" />Deleting…</>
              : <><Trash2 size={14} />Delete Device</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function DevicesPage() {
  const { token } = useAuth();
  const [devices,       setDevices]       = useState([]);
  const [showModal,     setShowModal]     = useState(false);
  const [form,          setForm]          = useState({ name: '', device_type: 'esp32', description: '' });
  const [deleteTarget,  setDeleteTarget]  = useState(null);   // device to confirm-delete
  const [deleteLoading, setDeleteLoading] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => { fetchDevices(); }, []);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/device/${deleteTarget.id}`);
      setDevices(prev => prev.filter(d => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete device');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Radio size={15} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">My Devices</h1>
            <p className="text-xs text-slate-500">{devices.length} device{devices.length !== 1 ? 's' : ''} registered</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 border border-sky-400/30 transition-all duration-150 shadow-lg shadow-sky-500/20"
        >
          <Plus size={15} />
          Add Device
        </button>
      </div>

      {/* Device grid */}
      {devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
            <Radio size={24} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium mb-1">No devices yet</p>
          <p className="text-sm text-slate-600 mb-5">Register your first IoT device to get started</p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 transition-colors"
          >
            <Plus size={14} />
            Add Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {devices.map(d => (
            <div
              key={d.id}
              className="group bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors relative"
            >
              {/* Delete button — top-right corner, appears on hover */}
              <button
                onClick={() => setDeleteTarget(d)}
                title="Delete device"
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:border-red-500/40 transition-all duration-150"
              >
                <Trash2 size={13} />
              </button>

              <div className="flex items-start justify-between mb-3">
                <div className="pr-8">
                  <h3 className="font-semibold text-slate-100 text-[15px]">{d.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
                    {DEVICE_TYPE_ICONS[d.device_type] || <Radio size={12} />}
                    <span className="capitalize">{d.device_type?.replace('_', ' ')}</span>
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0
                  ${d.is_online
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-slate-500 bg-slate-800 border-slate-700'}`}
                >
                  {d.is_online ? <Wifi size={10} /> : <WifiOff size={10} />}
                  {d.is_online ? 'Online' : 'Offline'}
                </span>
              </div>

              {d.description && (
                <p className="text-xs text-slate-500 mb-3 pr-2">{d.description}</p>
              )}

              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <Key size={11} className="text-slate-600 shrink-0" />
                  <span className="font-mono text-[11px] text-slate-600 truncate">{d.api_key}</span>
                </div>
                {d.last_seen && (
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    Last seen: {new Date(d.last_seen).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Device Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">Add Device</h2>
              <button onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Device name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required placeholder="e.g. Living Room Sensor"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Device type</label>
                <select
                  value={form.device_type}
                  onChange={e => setForm(f => ({ ...f, device_type: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                >
                  <option value="esp32">ESP32</option>
                  <option value="esp8266">ESP8266</option>
                  <option value="raspberry_pi">Raspberry Pi</option>
                  <option value="generic">Generic</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Description <span className="text-slate-600">(optional)</span></label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does this device do?"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                />
              </div>
              <button type="submit"
                className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-1 shadow-lg shadow-sky-500/20">
                <Plus size={14} />
                Register Device
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          device={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
