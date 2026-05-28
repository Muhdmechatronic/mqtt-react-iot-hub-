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

const s = {
  header:     { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  titleRow:   { display:'flex', alignItems:'center', gap:12 },
  title:      { fontSize:20, fontWeight:700, color:'#e2e8f0' },
  editBadge:  { background:'#0ea5e9', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 },
  btnRow:     { display:'flex', gap:8 },
  btn:        { border:'none', borderRadius:6, color:'#fff', padding:'7px 14px', cursor:'pointer', fontWeight:600, fontSize:13 },
  btnEdit:    { background:'#475569' },
  btnEditOn:  { background:'#16a34a' },
  btnAdd:     { background:'#0ea5e9' },
  btnDel:     { background:'#7f1d1d', color:'#fca5a5' },
  widgetShell:{ background:'#1e293b', borderRadius:10, overflow:'hidden', height:'100%', display:'flex', flexDirection:'column', position:'relative' },
  dragHandle: { height:22, background:'#0f172a', cursor:'grab', display:'flex', alignItems:'center', padding:'0 8px', gap:6, flexShrink:0 },
  handleDots: { fontSize:10, color:'#334155' },
  handleType: { fontSize:10, color:'#334155', marginLeft:'auto' },
  widgetBody: { flex:1, overflow:'hidden', position:'relative' },
  editOverlay:{ position:'absolute', inset:0, background:'rgba(2,10,20,.55)', display:'flex', alignItems:'center', justifyContent:'center', gap:10, zIndex:10, backdropFilter:'blur(1px)' },
  overlayBtn: { border:'none', borderRadius:6, color:'#fff', padding:'7px 14px', cursor:'pointer', fontWeight:600, fontSize:13 },
  editBtn:    { background:'#0ea5e9' },
  delBtn:     { background:'#ef4444' },
  empty:      { color:'#475569', fontSize:14, textAlign:'center', paddingTop:80 },
};

export default function DashboardPage() {
  const { id }     = useParams();
  const { token }  = useAuth();
  const navigate   = useNavigate();

  const [widgets,        setWidgets]        = useState([]);
  const [sensorData,     setSensorData]     = useState({});  // { [deviceId]: { [sensorType]: value } }
  const [lastEvent,      setLastEvent]      = useState(null);
  const [editMode,       setEditMode]       = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [editingWidget,  setEditingWidget]  = useState(null);
  const [gridWidth,      setGridWidth]      = useState(window.innerWidth - 260);
  const containerRef                        = useRef(null);

  // ── Responsive grid width ───────────────────────────────────────────────────
  useEffect(() => {
    function onResize() {
      if (containerRef.current) {
        setGridWidth(containerRef.current.offsetWidth);
      }
    }
    const ro = new ResizeObserver(onResize);
    if (containerRef.current) ro.observe(containerRef.current);
    onResize();
    return () => ro.disconnect();
  }, []);

  // ── Load widgets ────────────────────────────────────────────────────────────
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

  // ── WebSocket realtime stream ────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const socket    = getSocket(token);
    const deviceIds = [...new Set(widgets.map(w => w.device_id).filter(Boolean))];
    deviceIds.forEach(did => socket.emit('subscribe_device', { device_id: did }));

    function onUpdate(event) {
      // Keyed by deviceId so multiple devices never overwrite each other
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

  // ── Commands ────────────────────────────────────────────────────────────────
  // dataKey is the widget's data_key (e.g. "V5"). When provided, the new value
  // is immediately reflected in local sensorData (optimistic update) so reading
  // widgets (LEDs, Gauges) on the same dashboard update without a round-trip.
  async function onCommand(deviceId, command, payload, dataKey) {
    if (dataKey && payload?.value !== undefined) {
      setSensorData(prev => ({
        ...prev,
        [deviceId]: { ...(prev[deviceId] || {}), [dataKey]: payload.value },
      }));
    }
    try {
      await api.post('/device/command', { device_id: deviceId, command, payload, data_key: dataKey });
    } catch { /* optimistic update already applied; hardware delivery is best-effort */ }
  }

  // ── Layout persistence (fire only on drag/resize end) ──────────────────────
  async function saveLayout(layout) {
    try {
      await Promise.all(layout.map(item =>
        api.put(`/dashboard/widgets/${item.i}/layout`, { x: item.x, y: item.y, w: item.w, h: item.h })
      ));
    } catch { /* ignore transient errors */ }
  }

  // ── Widget CRUD ─────────────────────────────────────────────────────────────
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

  // ── Grid layout ─────────────────────────────────────────────────────────────
  const layout = widgets.map(w => ({
    i: String(w.id),
    x: w.position_x, y: w.position_y,
    w: w.width,      h: w.height,
    minW: 2, minH: 2,
  }));

  return (
    <div ref={containerRef}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.titleRow}>
          <div style={s.title}>Dashboard</div>
          {editMode && <span style={s.editBadge}>EDIT MODE</span>}
        </div>
        <div style={s.btnRow}>
          <button style={{ ...s.btn, ...s.btnDel }} onClick={handleDeleteDashboard}>
            🗑 Delete
          </button>
          <button
            style={{ ...s.btn, ...(editMode ? s.btnEditOn : s.btnEdit) }}
            onClick={() => setEditMode(e => !e)}
          >
            {editMode ? '✓ Done Editing' : '✏ Edit Layout'}
          </button>
          <button style={{ ...s.btn, ...s.btnAdd }} onClick={openCreate}>
            + Add Widget
          </button>
        </div>
      </div>

      {/* Empty state */}
      {widgets.length === 0 && (
        <div style={s.empty}>
          No widgets yet — click <strong>+ Add Widget</strong> to get started.
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
          <div key={String(w.id)} style={s.widgetShell}>
            {/* Drag handle */}
            <div className="drag-handle" style={{ ...s.dragHandle, cursor: editMode ? 'grab' : 'default' }}>
              <span style={s.handleDots}>⣿</span>
              <span style={{ fontSize:11, color:'#475569', flex:1 }}>{w.title}</span>
              <span style={s.handleType}>{w.type}</span>
            </div>

            {/* Widget body + edit overlay — only Delete available; all config is in Sandbox */}
            <div style={s.widgetBody}>
              {editMode && (
                <div style={s.editOverlay}>
                  <button style={{ ...s.overlayBtn, ...s.delBtn }} onClick={() => handleDelete(w.id)}>
                    🗑 Delete
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
