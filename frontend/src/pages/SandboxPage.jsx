import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import api from '../services/api';
import WidgetRenderer from '../widgets/WidgetRenderer';
import SandboxConfigPanel from '../components/sandbox/SandboxConfigPanel';

// ── Static preview values used in sandbox (no live data) ─────────────────────
// Widgets render with these realistic mock values so users see accurate previews.

const PREVIEW_VALUES = {
  gauge:       68,
  slider:      42,
  switch:      '1',
  linechart:   null,
  led:         1,
  button:      null,
  progressbar: 72,
};

// ── Pure SVG/CSS mini previews — used only in the DRAWER ─────────────────────

function GaugeMini() {
  return (
    <svg width="70" height="44" viewBox="0 0 70 44">
      <path d="M 7 40 A 28 28 0 0 1 63 40" stroke="#1e293b" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M 7 40 A 28 28 0 0 1 48 14" stroke="#38bdf8" strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="35" cy="40" r="3.5" fill="#cbd5e1" />
      <line x1="35" y1="37" x2="47" y2="16" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function SliderMini() {
  return (
    <div style={{ width: '100%', padding: '6px 2px' }}>
      <div style={{ position: 'relative', height: 6, background: '#1e293b', borderRadius: 99 }}>
        <div style={{ position: 'absolute', left: 0, width: '65%', height: '100%', background: '#0ea5e9', borderRadius: 99 }} />
        <div style={{ position: 'absolute', left: 'calc(65% - 8px)', top: -5, width: 16, height: 16, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
        <span>0</span><span>65</span><span>100</span>
      </div>
    </div>
  );
}

function SwitchMini() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 36, height: 20, background: '#0ea5e9', borderRadius: 99 }}>
        <div style={{ position: 'absolute', right: 3, top: 3, width: 14, height: 14, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
      </div>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>ON</span>
    </div>
  );
}

function ChartMini() {
  const pts = [18, 22, 19, 25, 28, 24, 30, 27, 33, 29, 35, 31];
  const max = Math.max(...pts), min = Math.min(...pts);
  const W = 100, H = 38;
  const path = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - ((v - min) / (max - min)) * (H - 4) - 2;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={path} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LEDMini() {
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', margin: '0 auto', background: 'radial-gradient(circle at 35% 35%, #86efac, #16a34a)', boxShadow: '0 0 14px #22c55e88, 0 0 4px #22c55e' }} />
  );
}

function ButtonMini() {
  return (
    <div style={{ width: '100%', padding: '7px 0', background: '#0284c7', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#fff', boxShadow: '0 3px 0 #0369a1' }}>
      PUSH
    </div>
  );
}

function ProgressMini() {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ height: 10, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: '72%', height: '100%', background: 'linear-gradient(to right,#0284c7,#38bdf8)', borderRadius: 99 }} />
      </div>
      <div style={{ textAlign: 'right', marginTop: 4, fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>72%</div>
    </div>
  );
}

const MINI_PREVIEWS = {
  gauge: GaugeMini, slider: SliderMini, switch: SwitchMini,
  linechart: ChartMini, led: LEDMini, button: ButtonMini, progressbar: ProgressMini,
};

const WIDGET_META = [
  { type: 'gauge',       label: 'Gauge',        icon: '🎯', desc: 'Analog dial' },
  { type: 'slider',      label: 'Slider',        icon: '🎚', desc: 'Range control' },
  { type: 'switch',      label: 'Switch',        icon: '🔘', desc: 'Toggle relay' },
  { type: 'linechart',   label: 'Line Chart',    icon: '📈', desc: 'Time series' },
  { type: 'led',         label: 'LED Indicator', icon: '💡', desc: 'Status light' },
  { type: 'button',      label: 'Push Button',   icon: '🟦', desc: 'Binary push' },
  { type: 'progressbar', label: 'Progress Bar',  icon: '📊', desc: 'Fill level' },
];

const WIDGET_SIZES = {
  gauge: { w: 3, h: 4 }, slider: { w: 4, h: 2 }, switch: { w: 2, h: 2 },
  linechart: { w: 6, h: 4 }, led: { w: 2, h: 2 }, button: { w: 2, h: 2 }, progressbar: { w: 4, h: 2 },
};

const DEFAULT_SETTINGS = {
  gauge:       { title: 'Gauge',        colorBasedOnValue: false, colorHex: '#38bdf8', overrideMinMax: false, colorThresholds: [], gradientMode: 'step' },
  slider:      { title: 'Slider',       sendOnReleaseOnly: false, handleStep: 1, showFineControls: false, valuePosition: 'right' },
  switch:      { title: 'Switch',       onValue: '1', offValue: '0', showLabels: false, onLabel: 'ON', offLabel: 'OFF', labelPosition: 'right', hideTitle: false, color: '#0ea5e9' },
  linechart:   { title: 'Line Chart',   chartType: 'area', timeWindow: '1h', colorHex: '#38bdf8', xAxisTitle: '', yAxisTitle: '' },
  led:         { title: 'LED',          colorOn: '#22c55e', colorOff: '#1e293b', ledMode: 'binary', threshold: 0.5, pwmMin: 0, pwmMax: 100 },
  button:      { title: 'Push Button',  onValue: '1', offValue: '0', showLabels: false, onLabel: 'ON', offLabel: 'OFF', labelPosition: 'right', hideTitle: false, color: '#0ea5e9' },
  progressbar: { title: 'Progress',     colorHex: '#38bdf8' },
};

const STORAGE_KEY = 'iot_sandbox_widgets';

// ── Adapt sandbox widget → WidgetRenderer format with mock preview data ───────
// data_key is set to '__preview__' so the renderer gets the static preview value
// from the mockSensorData object computed per widget in CanvasWidget.

function adaptForRenderer(widget, datastreamMap) {
  const s  = widget.settings || {};
  const ds = datastreamMap[s.datastreamId];
  const base = { ...s };

  if (widget.type === 'gauge') {
    base.color              = s.colorHex || '#38bdf8';
    base.min                = s.overrideMinMax ? (s.customMin ?? 0) : (ds?.min_value ?? 0);
    base.max                = s.overrideMinMax ? (s.customMax ?? 100) : (ds?.max_value ?? 100);
    base.unit               = ds?.unit || '';
    base.colorBasedOnValue  = s.colorBasedOnValue || false;
    base.colorThresholds    = s.colorThresholds || [];
    base.gradientMode       = s.gradientMode || 'step';
  }
  if (widget.type === 'slider') {
    base.color   = '#0ea5e9';
    base.min     = ds?.min_value ?? 0;
    base.max     = ds?.max_value ?? 100;
    base.unit    = ds?.unit || '';
    base.command = 'pwm';
  }
  if (widget.type === 'switch' || widget.type === 'button') {
    base.on_value       = s.onValue ?? '1';
    base.off_value      = s.offValue ?? '0';
    base.show_labels    = s.showLabels ?? false;
    base.on_label       = s.onLabel ?? 'ON';
    base.off_label      = s.offLabel ?? 'OFF';
    base.label_position = s.labelPosition ?? 'right';
    base.hide_title     = s.hideTitle ?? false;
    base.command        = 'relay';
  }
  if (widget.type === 'led') {
    base.color    = s.colorOn || '#22c55e';
    base.ledMode  = s.ledMode || 'binary';
    base.threshold = s.threshold ?? 0.5;
    base.pwmMin   = s.pwmMin ?? 0;
    base.pwmMax   = s.pwmMax ?? 100;
  }
  if (widget.type === 'linechart') {
    base.color       = s.colorHex || '#38bdf8';
    base.xAxisTitle  = s.xAxisTitle || '';
    base.yAxisTitle  = s.yAxisTitle || '';
  }

  return {
    id:            widget.id,
    type:          widget.type,
    title:         s.title || widget.type,
    data_key:      '__preview__',   // always resolved from the per-widget mock sensorData
    device_id:     null,            // no device in sandbox preview
    settings_json: base,
  };
}

// ── Widget drawer item ────────────────────────────────────────────────────────

function DrawerItem({ meta, onDragStart }) {
  const Preview = MINI_PREVIEWS[meta.type];
  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', meta.type);
        onDragStart(meta.type);
      }}
      style={{
        background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12,
        padding: 12, cursor: 'grab', userSelect: 'none', marginBottom: 8,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#0369a1'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#1e293b'}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
        {meta.icon} {meta.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 42 }}>
        {Preview && <div style={{ width: '100%' }}><Preview /></div>}
      </div>
      <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>{meta.desc}</div>
    </div>
  );
}

// ── Canvas widget — full WidgetRenderer with static preview data ──────────────

function CanvasWidget({ widget, editMode, onCopy, onDelete, onSettings, datastreamMap }) {
  const [hovered, setHovered] = useState(false);
  const adapted = adaptForRenderer(widget, datastreamMap);

  // Static preview sensor data — realistic values, no live streams
  const mockSensorData = { '__preview__': PREVIEW_VALUES[widget.type] };

  // Commands are no-ops in sandbox preview mode
  function noop() {}

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 12, overflow: 'hidden', position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Fully rendered widget with preview data */}
      <WidgetRenderer
        widget={adapted}
        sensorData={mockSensorData}
        lastEvent={null}
        onCommand={noop}
      />

      {/* Preview badge */}
      {!editMode && (
        <div style={{
          position: 'absolute', bottom: 4, right: 6,
          fontSize: 9, color: '#1e293b', fontFamily: 'monospace', fontWeight: 700,
          letterSpacing: '0.5px',
        }}>
          PREVIEW
        </div>
      )}

      {/* Edit mode: dim overlay + action buttons on hover.
          pointerEvents is 'none' when not hovered so RGL can still receive
          mousedown on the widget body for drag/resize. Switches to 'auto'
          only when hovered so the action buttons become clickable. */}
      {editMode && (
        <div style={{
          position: 'absolute', inset: 0,
          background: hovered ? 'rgba(2,10,20,.6)' : 'rgba(2,10,20,.2)',
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'background 0.15s',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
          padding: 6,
        }}>
          <div style={{
            display: 'flex', gap: 4,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s',
          }}>
            <ActionBtn title="Duplicate" onClick={() => onCopy(widget)} bg="#0f172a">📋</ActionBtn>
            <ActionBtn title="Settings"  onClick={() => onSettings(widget)} bg="#0c1a2e">⚙</ActionBtn>
            <ActionBtn title="Delete"    onClick={() => onDelete(widget.id)} bg="#1c0a0a">🗑</ActionBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ title, onClick, bg, children }) {
  return (
    <button
      title={title}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        width: 28, height: 28, background: bg, border: '1px solid #334155',
        borderRadius: 6, color: '#94a3b8', fontSize: 13, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#64748b'; e.currentTarget.style.color = '#e2e8f0'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; }}
    >
      {children}
    </button>
  );
}

// ── Normalize sandbox settings → widget-readable format ──────────────────────
// Sandbox stores settings in its own camelCase/prefixed format (colorHex, colorOn,
// onValue, overrideMinMax, etc.). Each widget component reads specific field names
// (color, min, max, on_value, etc.). This function bridges the gap at save time so
// settings_json in the DB is always in the format the widget components expect.
// The linked datastream (ds) is passed so min/max/unit are resolved from it.

function normalizeSettings(widget, ds) {
  const s = widget.settings || {};

  switch (widget.type) {
    case 'gauge':
      return {
        ...s,
        color:             s.colorHex || '#38bdf8',
        min:               s.overrideMinMax ? (s.customMin  ?? 0)   : (ds?.min_value ?? 0),
        max:               s.overrideMinMax ? (s.customMax  ?? 100)  : (ds?.max_value ?? 100),
        unit:              ds?.unit || '',
        colorBasedOnValue: s.colorBasedOnValue  || false,
        colorThresholds:   s.colorThresholds    || [],
        gradientMode:      s.gradientMode       || 'step',
      };

    case 'slider':
      return {
        ...s,
        color:   '#0ea5e9',
        min:     ds?.min_value ?? 0,
        max:     ds?.max_value ?? 100,
        unit:    ds?.unit || '',
        command: 'pwm',
      };

    case 'switch':
    case 'button':
      return {
        ...s,
        on_value:       s.onValue       ?? s.on_value       ?? '1',
        off_value:      s.offValue      ?? s.off_value      ?? '0',
        show_labels:    s.showLabels    ?? s.show_labels    ?? false,
        on_label:       s.onLabel       ?? s.on_label       ?? 'ON',
        off_label:      s.offLabel      ?? s.off_label      ?? 'OFF',
        label_position: s.labelPosition ?? s.label_position ?? 'right',
        hide_title:     s.hideTitle     ?? s.hide_title     ?? false,
        command:        'relay',
      };

    case 'led':
      return {
        ...s,
        color:     s.colorOn  || '#22c55e',
        colorOff:  s.colorOff || '#1e293b',
        ledMode:   s.ledMode  || 'binary',
        threshold: s.threshold  ?? 0.5,
        pwmMin:    s.pwmMin     ?? 0,
        pwmMax:    s.pwmMax     ?? 100,
      };

    case 'linechart':
      return {
        ...s,
        color:      s.colorHex    || '#38bdf8',
        xAxisTitle: s.xAxisTitle  || '',
        yAxisTitle: s.yAxisTitle  || '',
      };

    case 'progressbar':
      return {
        ...s,
        color: s.colorHex || s.color || '#38bdf8',
        min:   ds?.min_value ?? 0,
        max:   ds?.max_value ?? 100,
        unit:  ds?.unit || '',
      };

    default:
      return s;
  }
}

// ── Save dialog ───────────────────────────────────────────────────────────────

function SaveDialog({ devices, deviceId, widgets, datastreamMap, onClose }) {
  const navigate             = useNavigate();
  const [name,    setName]   = useState('My Dashboard');
  const [selDev,  setSelDev] = useState(deviceId);
  const [saving,  setSaving] = useState(false);
  const [err,     setErr]    = useState('');

  async function handleSave() {
    if (!name.trim()) return setErr('Dashboard name is required');
    if (!widgets.length) return setErr('Canvas is empty — add at least one widget');
    setSaving(true);
    setErr('');
    try {
      // Backend does upsert: same name for same user → clears & overwrites existing
      const { data: dash } = await api.post('/dashboard', { name: name.trim() });

      const devId = selDev ? parseInt(selDev) : null;
      for (const w of widgets) {
        // Resolve data_key from the linked datastream's virtual_pin.
        // This is the key that WidgetRenderer uses to look up sensorData and
        // that writing widgets (Button, Slider, Switch) pass to onCommand so
        // the backend can broadcast a sensor_update on the same key.
        const ds      = datastreamMap[w.settings?.datastreamId];
        const dataKey = ds ? `V${ds.virtual_pin}` : null;

        await api.post(`/dashboard/${dash.id}/widgets`, {
          type:          w.type,
          title:         w.settings?.title || w.type,
          device_id:     devId,
          datastream_id: w.settings?.datastreamId || null,
          data_key:      dataKey,
          x: w.x, y: w.y, w: w.w, h: w.h,
          settings:      normalizeSettings(w, ds),
        });
      }

      window.dispatchEvent(new CustomEvent('iot:dashboard-created'));
      navigate(`/dashboard/${dash.id}`);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to save dashboard');
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, width: 380, padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', marginBottom: 2 }}>Save to Dashboards</div>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>
          {widgets.length} widget{widgets.length !== 1 ? 's' : ''} · same name will overwrite existing
        </div>

        <label style={lbl}>Dashboard Name</label>
        <input
          autoFocus style={inp} value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="e.g. Home Sensors"
        />

        <label style={lbl}>Bind Device (for live data on dashboard)</label>
        <select style={inp} value={selDev} onChange={e => setSelDev(e.target.value)}>
          <option value="">— No device —</option>
          {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={secondaryBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : '✓ Save Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}

const lbl         = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 };
const inp         = { display: 'block', width: '100%', background: '#020617', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: '8px 12px', fontSize: 13, outline: 'none', marginBottom: 14, boxSizing: 'border-box' };
const primaryBtn  = { background: '#0284c7', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const secondaryBtn = { background: 'none', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', padding: '8px 18px', fontSize: 13, cursor: 'pointer' };

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SandboxPage() {
  const [editMode,       setEditMode]       = useState(false);
  const [settingsWidget, setSettingsWidget] = useState(null);
  const [saveDialog,     setSaveDialog]     = useState(false);
  const [devices,        setDevices]        = useState([]);
  const [deviceId,       setDeviceId]       = useState('');
  const [datastreams,    setDatastreams]    = useState([]);
  const [canvasWidth,    setCanvasWidth]    = useState(800);
  const [droppingType,   setDroppingType]   = useState(null);
  const [tick,           setTick]           = useState(0);
  const droppingTypeRef = useRef(null);
  const canvasRef       = useRef(null);

  // ── Animated preview values for SandboxConfigPanel's LiveSyncBadge ───────────
  // Updated every 500 ms. Uses sine waves / toggles to simulate realistic feeds.
  // These values are NOT injected into canvas widgets — CanvasWidget uses the
  // static PREVIEW_VALUES map. This is only for the config panel's live badge.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const mockData = useMemo(() => {
    const t = tick * 0.5; // seconds elapsed
    return {
      gauge:       parseFloat((50 + 30 * Math.sin(t / 8)).toFixed(2)),
      slider:      parseFloat((40 + 20 * Math.sin(t / 5)).toFixed(2)),
      switch:      Math.round(t / 3) % 2,
      button:      null,
      led:         parseFloat(Math.max(0, Math.sin(t / 4)).toFixed(2)),
      linechart:   null,
      progressbar: parseFloat((60 + 15 * Math.sin(t / 6)).toFixed(2)),
    };
  }, [tick]);

  const [widgets, setWidgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  });

  function updateWidgets(updater) {
    setWidgets(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // datastreamId → datastream object (for min/max/unit in preview)
  const datastreamMap = useMemo(
    () => Object.fromEntries(datastreams.map(ds => [ds.id, ds])),
    [datastreams]
  );

  useEffect(() => {
    api.get('/device/list').then(r => {
      setDevices(r.data);
      if (r.data.length > 0) setDeviceId(String(r.data[0].id));
    }).catch(() => {});
  }, []);

  // Fetch datastreams for selected device (used by settings modal DatastreamSelect + adaptForRenderer)
  useEffect(() => {
    if (!deviceId) { setDatastreams([]); return; }
    api.get(`/datastream?device_id=${deviceId}`)
      .then(r => setDatastreams(r.data))
      .catch(() => setDatastreams([]));
  }, [deviceId]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setCanvasWidth(w);
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  const layout = widgets.map(w => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 2 }));

  function onLayoutChange(newLayout) {
    updateWidgets(prev => prev.map(w => {
      const l = newLayout.find(item => item.i === w.id);
      return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w;
    }));
  }

  function handleDragStart(type) {
    droppingTypeRef.current = type;
    setDroppingType(type);
  }

  function onDrop(_, item) {
    const type = droppingTypeRef.current;
    droppingTypeRef.current = null;
    setDroppingType(null);
    if (!type) return;
    const sz = WIDGET_SIZES[type] || { w: 3, h: 3 };
    updateWidgets(prev => [...prev, {
      id:       `w_${Date.now()}`,
      type,
      x:        item.x,
      y:        item.y,
      w:        item.w || sz.w,
      h:        item.h || sz.h,
      settings: { ...DEFAULT_SETTINGS[type] },
    }]);
  }

  const duplicateWidget = useCallback((widget) => {
    updateWidgets(prev => [...prev, {
      ...widget,
      id: `w_${Date.now()}`,
      x:  Math.min(widget.x + widget.w, 12 - widget.w),
      y:  widget.y + widget.h,
    }]);
  }, []);

  const deleteWidget = useCallback((id) => {
    updateWidgets(prev => prev.filter(w => w.id !== id));
  }, []);

  function saveSettings(updated) {
    updateWidgets(prev => prev.map(w => w.id === updated.id ? updated : w));
    setSettingsWidget(null);
  }

  const sz          = droppingType ? (WIDGET_SIZES[droppingType] || { w: 3, h: 3 }) : { w: 3, h: 3 };
  const droppingItem = { i: '__dropping__', w: sz.w, h: sz.h };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#020617', color: '#e2e8f0' }}>

      {/* ── Top bar ── */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>Dashboard Sandbox</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            {editMode
              ? 'Edit Mode — drag widgets, hover to copy / configure / delete'
              : 'Preview Mode — widgets show realistic mock data  ·  Toggle Edit to modify'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Device selector — used when binding datastreams in settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '5px 10px' }}>
            <span style={{ fontSize: 11, color: '#475569' }}>Device:</span>
            <select
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              {!devices.length && <option>No devices</option>}
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {widgets.length > 0 && (
            <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
              {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
            </span>
          )}

          {widgets.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Clear all widgets?')) updateWidgets([]); }}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}
            >
              Clear
            </button>
          )}

          {widgets.length > 0 && (
            <button
              onClick={() => setSaveDialog(true)}
              style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              💾 Save to Dashboards
            </button>
          )}

          {/* Edit Mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: editMode ? '#38bdf8' : '#64748b' }}>
              {editMode ? '✏ Edit' : '👁 Preview'}
            </span>
            <button
              onClick={() => setEditMode(m => !m)}
              style={{
                position: 'relative', width: 44, height: 24, borderRadius: 99,
                background: editMode ? '#0284c7' : '#1e293b', border: 'none', cursor: 'pointer',
                transition: 'background 0.2s', padding: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.4)',
                transition: 'left 0.2s', left: editMode ? 23 : 3,
              }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Workspace ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Widget Drawer — visible only in edit mode */}
        <div style={{
          width: editMode ? 184 : 0, flexShrink: 0, overflow: 'hidden',
          background: '#0f172a', borderRight: '1px solid #1e293b',
          transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
        }}>
          {editMode && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '1px', textTransform: 'uppercase' }}>Widget Box</div>
                <div style={{ fontSize: 10, color: '#1e293b', marginTop: 2 }}>Drag onto canvas →</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                {WIDGET_META.map(meta => (
                  <DrawerItem key={meta.type} meta={meta} onDragStart={handleDragStart} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div ref={canvasRef} style={{ flex: 1, overflowY: 'auto', padding: 16, position: 'relative', minWidth: 0 }}>

          {!widgets.length && (
            <div style={{
              height: 280, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              border: '2px dashed #1e293b', borderRadius: 16, margin: 8,
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{editMode ? '⬅' : '🎨'}</div>
              <div style={{ fontWeight: 600, color: '#334155', fontSize: 15 }}>
                {editMode ? 'Drag widgets from the panel' : 'Canvas is empty'}
              </div>
              <div style={{ color: '#1e293b', fontSize: 12, marginTop: 6 }}>
                {editMode ? 'Drop anywhere on this grid' : 'Toggle Edit Mode to start building'}
              </div>
            </div>
          )}

          {/* Grid — always mounted to avoid RGL DOM errors on unmount */}
          <div style={{ display: widgets.length === 0 ? 'none' : 'block' }}>
            <GridLayout
              layout={layout}
              cols={12}
              rowHeight={80}
              width={Math.max(canvasWidth - 32, 480)}
              isDraggable={editMode}
              isResizable={editMode}
              isDroppable={editMode}
              droppingItem={droppingItem}
              onLayoutChange={onLayoutChange}
              onDrop={onDrop}
              containerPadding={[0, 0]}
              margin={[10, 10]}
            >
              {widgets.map(w => (
                <div key={w.id}>
                  <CanvasWidget
                    widget={w}
                    editMode={editMode}
                    onCopy={duplicateWidget}
                    onDelete={deleteWidget}
                    onSettings={setSettingsWidget}
                    datastreamMap={datastreamMap}
                  />
                </div>
              ))}
            </GridLayout>
          </div>

          {/* Drop zone for empty canvas in edit mode */}
          {widgets.length === 0 && editMode && (
            <GridLayout
              layout={[]} cols={12} rowHeight={80}
              width={Math.max(canvasWidth - 32, 480)}
              isDraggable={false} isResizable={false}
              isDroppable={true} droppingItem={droppingItem}
              onDrop={onDrop}
              containerPadding={[0, 0]} margin={[10, 10]}
              style={{ minHeight: 160 }}
            >
              {[]}
            </GridLayout>
          )}
        </div>

        {/* Config Panel — right-side slide-in, visible when a widget is selected */}
        <div style={{
          width: settingsWidget ? 320 : 0, flexShrink: 0, overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
          display: 'flex',
        }}>
          {settingsWidget && (
            <SandboxConfigPanel
              widget={settingsWidget}
              deviceId={deviceId}
              mockValue={mockData[settingsWidget.type]}
              onClose={() => setSettingsWidget(null)}
              onSave={saveSettings}
            />
          )}
        </div>
      </div>

      {/* Edit mode info bar */}
      {editMode && (
        <div style={{ background: 'rgba(2,132,199,0.1)', borderTop: '1px solid rgba(2,132,199,0.2)', padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>EDIT MODE</span>
          <span style={{ fontSize: 11, color: '#334155' }}>Drag · Resize corners · Hover widget for Copy / Settings / Delete</span>
        </div>
      )}

      {saveDialog && (
        <SaveDialog
          devices={devices}
          deviceId={deviceId}
          widgets={widgets}
          datastreamMap={datastreamMap}
          onClose={() => setSaveDialog(false)}
        />
      )}

    </div>
  );
}
