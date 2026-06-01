import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import WidgetRenderer from '../widgets/WidgetRenderer';
import WidgetModal from '../components/WidgetModal';
import {
  GripVertical, Trash2, Pencil, Plus,
  LayoutDashboard, Layers, Wifi, WifiOff,
  Cpu, Radio, CircuitBoard, Activity,
} from 'lucide-react';

const DEVICE_TYPE_ICONS = {
  esp32:        Cpu,
  esp8266:      Cpu,
  raspberry_pi: CircuitBoard,
  generic:      Radio,
};

/* ── Pulsing online dot ────────────────────────────────────────────────────── */
function PulsingDot({ online }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {online && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
    </span>
  );
}

/* ── Device status pill ────────────────────────────────────────────────────── */
function DevicePill({ device }) {
  const online  = Boolean(device.is_online);
  const TypeIcon = DEVICE_TYPE_ICONS[device.device_type] || Radio;

  return (
    <div
      title={`${device.name} · ${device.device_type?.replace('_', ' ')} · ${online ? 'Online' : 'Offline'}`}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all
        ${online
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : 'bg-slate-800/80 border-slate-700 text-slate-500'}`}
    >
      <PulsingDot online={online} />
      <TypeIcon size={10} className="shrink-0" />
      <span className="max-w-[110px] truncate">{device.name}</span>
      <span className={`opacity-70 ${online ? '' : 'text-slate-600'}`}>
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

/* ── Summary stat chip ─────────────────────────────────────────────────────── */
function StatChip({ label, value, accent }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${accent}`}>
      {value} <span className="opacity-60">{label}</span>
    </span>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { id }    = useParams();
  const { token } = useAuth();

  const [widgets,       setWidgets]       = useState([]);
  const [sensorData,    setSensorData]    = useState({});
  const [lastEvent,     setLastEvent]     = useState(null);
  const [editMode,      setEditMode]      = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [gridWidth,     setGridWidth]     = useState(window.innerWidth - 260);
  const [dashboardName, setDashboardName] = useState('');
  const [deviceMap,     setDeviceMap]     = useState({});
  const containerRef                      = useRef(null);

  /* ── Resize observer ── */
  useEffect(() => {
    function onResize() {
      if (containerRef.current) setGridWidth(containerRef.current.offsetWidth);
    }
    const ro = new ResizeObserver(onResize);
    if (containerRef.current) ro.observe(containerRef.current);
    onResize();
    return () => ro.disconnect();
  }, []);

  /* ── Load widgets ── */
  const loadWidgets = useCallback(() => {
    api.get(`/dashboard/${id}/widgets`).then(r => setWidgets(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    setWidgets([]);
    setSensorData({});
    setLastEvent(null);
    setEditMode(false);
    loadWidgets();
  }, [id]);

  /* ── Fetch dashboard name ── */
  useEffect(() => {
    api.get('/dashboard')
      .then(r => {
        const dash = r.data.find(d => String(d.id) === String(id));
        setDashboardName(dash?.name || 'Dashboard');
      })
      .catch(() => setDashboardName('Dashboard'));
  }, [id]);

  /* ── Fetch device list ── */
  useEffect(() => {
    api.get('/device/list')
      .then(r => {
        const map = {};
        r.data.forEach(d => { map[d.id] = d; });
        setDeviceMap(map);
      })
      .catch(() => {});
  }, []);

  /* ── Socket: sensor data + real-time device status ── */
  useEffect(() => {
    if (!token) return;
    const socket    = getSocket(token);
    const deviceIds = [...new Set(widgets.map(w => w.device_id).filter(Boolean))];
    deviceIds.forEach(did => socket.emit('subscribe_device', { device_id: did }));

    // Legacy sensor_update path (HTTP POST, MQTT sensor topic, WebSocket device_data)
    function onSensorUpdate(event) {
      setSensorData(prev => ({
        ...prev,
        [event.device_id]: { ...(prev[event.device_id] || {}), ...event.data },
      }));
      setLastEvent({ ...event, _ts: Date.now() });
    }

    // Virtual-pin path (MQTT iot/{key}/pin/{n}, socket pin:write)
    // Payload: { deviceId: string, virtualPin: number, value: any, ... }
    function onPinUpdate(event) {
      const devId  = Number(event.deviceId);
      const pinKey = `V${event.virtualPin}`;
      setSensorData(prev => ({
        ...prev,
        [devId]: { ...(prev[devId] || {}), [pinKey]: event.value },
      }));
      setLastEvent({
        device_id: devId,
        data:      { [pinKey]: event.value },
        _ts:       Date.now(),
      });
    }

    function onDeviceStatus({ device_id, is_online }) {
      setDeviceMap(prev => {
        if (!prev[device_id]) return prev;
        return { ...prev, [device_id]: { ...prev[device_id], is_online: is_online ? 1 : 0 } };
      });
    }

    socket.on('sensor_update', onSensorUpdate);
    socket.on('pin:update',    onPinUpdate);
    socket.on('device_status', onDeviceStatus);
    return () => {
      socket.off('sensor_update', onSensorUpdate);
      socket.off('pin:update',    onPinUpdate);
      socket.off('device_status', onDeviceStatus);
      deviceIds.forEach(did => socket.emit('unsubscribe_device', { device_id: did }));
    };
  }, [widgets, token]);

  /* ── Derived: devices used in this dashboard ── */
  const dashboardDeviceIds = [...new Set(widgets.map(w => w.device_id).filter(Boolean))];
  const dashboardDevices   = dashboardDeviceIds.map(did => deviceMap[did]).filter(Boolean);
  const onlineCount        = dashboardDevices.filter(d => d.is_online).length;

  /* ── Actions ── */
  async function onCommand(deviceId, command, payload, dataKey) {
    if (!deviceId) return;
    if (dataKey && payload?.value !== undefined) {
      setSensorData(prev => ({
        ...prev,
        [deviceId]: { ...(prev[deviceId] || {}), [dataKey]: payload.value },
      }));
    }
    try {
      await api.post('/device/command', {
        device_id: deviceId,
        command,
        payload,
        data_key: dataKey,
      });
    } catch (err) {
      console.warn('[command] failed:', err?.response?.data?.error || err.message);
    }
  }

  async function saveLayout(layout) {
    try {
      await Promise.all(layout.map(item =>
        api.put(`/dashboard/widgets/${item.i}/layout`, { x: item.x, y: item.y, w: item.w, h: item.h })
      ));
    } catch { /* ignore */ }
  }

  function openCreate() { setEditingWidget(null); setShowModal(true); }
  function openEdit(w)  { setEditingWidget(w);    setShowModal(true); }

  /* ── Sidebar event bridge ── */
  // Broadcast editMode so the sidebar can reflect the toggle icon state
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('iot:dashboard:edit-changed', { detail: { editing: editMode, dashId: id } }));
  }, [editMode, id]);

  // Listen for sidebar "Edit Layout" and "Add Widget" button presses
  useEffect(() => {
    function onToggleEdit() { setEditMode(e => !e); }
    function onAddWidget()  { openCreate(); }
    window.addEventListener('iot:dashboard:toggle-edit', onToggleEdit);
    window.addEventListener('iot:dashboard:add-widget',  onAddWidget);
    return () => {
      window.removeEventListener('iot:dashboard:toggle-edit', onToggleEdit);
      window.removeEventListener('iot:dashboard:add-widget',  onAddWidget);
    };
  }, []);

  async function handleDelete(widgetId) {
    if (!window.confirm('Delete this widget?')) return;
    try {
      await api.delete(`/dashboard/widgets/${widgetId}`);
      setWidgets(prev => prev.filter(w => w.id !== widgetId));
    } catch { alert('Delete failed'); }
  }

  function handleModalSaved() {
    setShowModal(false);
    setEditingWidget(null);
    loadWidgets();
  }

  const layout = widgets.map(w => ({
    i: String(w.id),
    x: w.position_x, y: w.position_y,
    w: w.width,      h: w.height,
    minW: 2, minH: 2,
  }));

  return (
    <div ref={containerRef}>

      {/* ── Professional Dashboard Header ──────────────────────────────────── */}
      <div className="mb-6">

        {/* ── Top row: identity ── */}
        <div className="flex items-start mb-3">

          {/* Icon + name + subtitle */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 shadow-inner">
              <LayoutDashboard size={18} className="text-sky-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-100 truncate leading-tight">
                  {dashboardName || (
                    <span className="w-28 h-5 bg-slate-800 rounded animate-pulse inline-block" />
                  )}
                </h1>
                {editMode && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 uppercase tracking-wider shrink-0">
                    <Pencil size={9} />
                    Edit Mode
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium">IoT Platform</span>
                <span className="text-slate-700 text-[10px]">·</span>
                <StatChip value={widgets.length} label={widgets.length !== 1 ? 'widgets' : 'widget'} accent="text-slate-500" />
                {dashboardDevices.length > 0 && (
                  <>
                    <span className="text-slate-700 text-[10px]">·</span>
                    <StatChip
                      value={onlineCount}
                      label={`/ ${dashboardDevices.length} online`}
                      accent={onlineCount > 0 ? 'text-emerald-400 bg-emerald-500/10 rounded-full px-2' : 'text-slate-500'}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Device status strip ── */}
        {dashboardDevices.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600 uppercase tracking-widest shrink-0">
              <Activity size={10} />
              Devices
            </div>
            <div className="h-3 w-px bg-slate-800 shrink-0" />
            {dashboardDevices.map(d => (
              <DevicePill key={d.id} device={d} />
            ))}
          </div>
        )}

        {/* ── Divider ── */}
        <div className="mt-4 h-px bg-gradient-to-r from-slate-800 via-slate-700/50 to-transparent" />
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
            <Layers size={24} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium mb-1">No widgets yet</p>
          <p className="text-sm text-slate-600 mb-5">Add your first widget to start monitoring your devices</p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 transition-colors"
          >
            <Plus size={14} />
            Add Widget
          </button>
        </div>
      )}

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={80}
        width={Math.max(gridWidth, 480)}
        isDraggable={editMode}
        isResizable={editMode}
        onDragStop={saveLayout}
        onResizeStop={saveLayout}
        draggableHandle=".drag-handle"
        margin={[10, 10]}
      >
        {widgets.map(w => (
          <div
            key={String(w.id)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col relative h-full"
          >
            {/* Drag handle + widget title */}
            <div
              className={`drag-handle flex items-center gap-2 px-3 h-8 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/50 shrink-0 ${editMode ? 'cursor-grab' : 'cursor-default'}`}
            >
              <GripVertical size={13} className="text-slate-400 dark:text-slate-600 shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 truncate font-medium">{w.title}</span>

              {/* Inline device online indicator */}
              {w.device_id && deviceMap[w.device_id] && (
                <span className="flex items-center gap-1 shrink-0">
                  <PulsingDot online={Boolean(deviceMap[w.device_id]?.is_online)} />
                </span>
              )}

              <span className="text-[10px] text-slate-500 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono shrink-0">{w.type}</span>
            </div>

            {/* Widget body */}
            <div className="flex-1 overflow-hidden relative">
              {editMode && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center gap-2 z-10">
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-400 transition-colors shadow-lg"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
              <WidgetRenderer
                widget={w}
                sensorData={sensorData[w.device_id] || {}}
                lastEvent={lastEvent}
                onCommand={onCommand}
              />
            </div>
          </div>
        ))}
      </GridLayout>

      {/* ── Widget modal ───────────────────────────────────────────────────── */}
      {showModal && (
        <WidgetModal
          dashboardId={id}
          widget={editingWidget}
          onClose={() => { setShowModal(false); setEditingWidget(null); }}
          onSaved={handleModalSaved}
        />
      )}
    </div>
  );
}
