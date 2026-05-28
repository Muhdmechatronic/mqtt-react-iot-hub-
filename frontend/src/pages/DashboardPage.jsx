import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import WidgetRenderer from '../widgets/WidgetRenderer';
import WidgetModal from '../components/WidgetModal';
import {
  GripVertical, Trash2, Pencil, Plus, Check,
  LayoutDashboard, AlertTriangle, Layers,
} from 'lucide-react';

export default function DashboardPage() {
  const { id }    = useParams();
  const { token } = useAuth();
  const navigate  = useNavigate();

  const [widgets,       setWidgets]       = useState([]);
  const [sensorData,    setSensorData]    = useState({});
  const [lastEvent,     setLastEvent]     = useState(null);
  const [editMode,      setEditMode]      = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [gridWidth,     setGridWidth]     = useState(window.innerWidth - 260);
  const containerRef                      = useRef(null);

  useEffect(() => {
    function onResize() {
      if (containerRef.current) setGridWidth(containerRef.current.offsetWidth);
    }
    const ro = new ResizeObserver(onResize);
    if (containerRef.current) ro.observe(containerRef.current);
    onResize();
    return () => ro.disconnect();
  }, []);

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

  useEffect(() => {
    if (!token) return;
    const socket    = getSocket(token);
    const deviceIds = [...new Set(widgets.map(w => w.device_id).filter(Boolean))];
    deviceIds.forEach(did => socket.emit('subscribe_device', { device_id: did }));

    function onUpdate(event) {
      setSensorData(prev => ({
        ...prev,
        [event.device_id]: { ...(prev[event.device_id] || {}), ...event.data },
      }));
      setLastEvent({ ...event, _ts: Date.now() });
    }

    socket.on('sensor_update', onUpdate);
    return () => {
      socket.off('sensor_update', onUpdate);
      deviceIds.forEach(did => socket.emit('unsubscribe_device', { device_id: did }));
    };
  }, [widgets, token]);

  async function onCommand(deviceId, command, payload, dataKey) {
    if (dataKey && payload?.value !== undefined) {
      setSensorData(prev => ({
        ...prev,
        [deviceId]: { ...(prev[deviceId] || {}), [dataKey]: payload.value },
      }));
    }
    try {
      await api.post('/device/command', { device_id: deviceId, command, payload, data_key: dataKey });
    } catch { /* optimistic update already applied */ }
  }

  async function saveLayout(layout) {
    try {
      await Promise.all(layout.map(item =>
        api.put(`/dashboard/widgets/${item.i}/layout`, { x: item.x, y: item.y, w: item.w, h: item.h })
      ));
    } catch { /* ignore transient errors */ }
  }

  async function handleDeleteDashboard() {
    if (!window.confirm('Delete this entire dashboard? All widgets will be removed. This cannot be undone.')) return;
    try {
      await api.delete(`/dashboard/${id}`);
      window.dispatchEvent(new CustomEvent('iot:dashboard-deleted', { detail: { id: parseInt(id) } }));
      navigate('/devices');
    } catch { alert('Failed to delete dashboard'); }
  }

  function openCreate() { setEditingWidget(null); setShowModal(true); }
  function openEdit(w)  { setEditingWidget(w);    setShowModal(true); }

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
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <LayoutDashboard size={15} className="text-sky-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-100">Dashboard</h1>
          {editMode && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
              <Pencil size={10} />
              EDIT MODE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDeleteDashboard}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all duration-150"
          >
            <Trash2 size={14} />
            Delete
          </button>
          <button
            onClick={() => setEditMode(e => !e)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 border
              ${editMode
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'text-slate-300 bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
          >
            {editMode ? <><Check size={14} /> Done</> : <><Pencil size={14} /> Edit Layout</>}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 border border-sky-400/30 transition-all duration-150 shadow-lg shadow-sky-500/20"
          >
            <Plus size={14} />
            Add Widget
          </button>
        </div>
      </div>

      {/* Empty state */}
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

      {/* Grid */}
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
            {/* Drag handle */}
            <div
              className={`drag-handle flex items-center gap-2 px-3 h-8 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/50 shrink-0 ${editMode ? 'cursor-grab' : 'cursor-default'}`}
            >
              <GripVertical size={13} className="text-slate-400 dark:text-slate-600 shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 truncate font-medium">{w.title}</span>
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

      {/* Modal */}
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
