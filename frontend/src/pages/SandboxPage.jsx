import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── File helpers ─────────────────────────────────────────────────────────── */
function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => { try { resolve(JSON.parse(e.target.result)); } catch { reject(new Error('Invalid JSON')); } };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import api from '../services/api';
import WidgetRenderer from '../widgets/WidgetRenderer';
import SandboxConfigPanel from '../components/sandbox/SandboxConfigPanel';
import {
  Target, SlidersHorizontal, ToggleRight, AreaChart,
  Lightbulb, Square, BarChart2, Save, Pencil, Eye,
  Layers, Copy, Settings, Trash2, X, Check, Plus,
  ChevronRight, Cpu, Upload, Download as DownloadIcon, FolderOpen,
} from 'lucide-react';

const PREVIEW_VALUES = {
  gauge: 68, slider: 42, switch: '1', linechart: null,
  led: 1, button: null, progressbar: 72,
};

// ── Mini SVG previews for the widget drawer ───────────────────────────────────

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
    <div className="w-full px-0.5 py-1.5">
      <div className="relative h-1.5 bg-slate-800 rounded-full">
        <div className="absolute left-0 w-[65%] h-full bg-sky-500 rounded-full" />
        <div className="absolute top-[-5px] w-4 h-4 bg-white rounded-full shadow-md" style={{ left: 'calc(65% - 8px)' }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[9px] text-slate-600 font-mono">
        <span>0</span><span>65</span><span>100</span>
      </div>
    </div>
  );
}

function SwitchMini() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-9 h-5 bg-sky-500 rounded-full">
        <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
      </div>
      <span className="text-[11px] text-slate-400 font-semibold">ON</span>
    </div>
  );
}

function ChartMini() {
  const pts = [14, 20, 17, 26, 24, 30, 27, 34, 30, 38, 34, 40];
  const max = Math.max(...pts), min = Math.min(...pts);
  const W = 100, H = 40;

  const points = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * W,
    y: H - ((v - min) / (max - min)) * (H - 6) - 3,
  }));

  // Smooth cubic bezier path
  let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1], p1 = points[i];
    const cpX = (p0.x + p1.x) / 2;
    linePath += ` C ${cpX.toFixed(1)} ${p0.y.toFixed(1)}, ${cpX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const last  = points[points.length - 1];
  const first = points[0];
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${H} L ${first.x.toFixed(1)} ${H} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="cmgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#cmgrad)" />
      <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LEDMini() {
  return (
    <div className="w-8 h-8 rounded-full mx-auto" style={{ background: 'radial-gradient(circle at 35% 35%, #86efac, #16a34a)', boxShadow: '0 0 14px #22c55e88, 0 0 4px #22c55e' }} />
  );
}

function ButtonMini() {
  return (
    <div className="w-full py-1.5 bg-sky-600 rounded-lg text-center text-xs font-bold text-white" style={{ boxShadow: '0 3px 0 #0369a1' }}>
      PUSH
    </div>
  );
}

function ProgressMini() {
  return (
    <div className="w-full">
      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="w-[72%] h-full rounded-full" style={{ background: 'linear-gradient(to right,#0284c7,#38bdf8)' }} />
      </div>
      <div className="text-right mt-1 text-[10px] text-slate-600 font-mono">72%</div>
    </div>
  );
}

const MINI_PREVIEWS = {
  gauge: GaugeMini, slider: SliderMini, switch: SwitchMini,
  linechart: ChartMini, led: LEDMini, button: ButtonMini, progressbar: ProgressMini,
};

const WIDGET_META = [
  { type: 'gauge',       label: 'Gauge',        Icon: Target,            desc: 'Analog dial' },
  { type: 'slider',      label: 'Slider',        Icon: SlidersHorizontal, desc: 'Range control' },
  { type: 'switch',      label: 'Switch',        Icon: ToggleRight,       desc: 'Toggle relay' },
  { type: 'linechart',   label: 'Chart',          Icon: AreaChart,         desc: 'Time series' },
  { type: 'led',         label: 'LED Indicator', Icon: Lightbulb,         desc: 'Status light' },
  { type: 'button',      label: 'Push Button',   Icon: Square,            desc: 'Binary push' },
  { type: 'progressbar', label: 'Progress Bar',  Icon: BarChart2,         desc: 'Fill level' },
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
  progressbar: { title: 'Progress', colorHex: '#38bdf8', smartColor: true },
};

const STORAGE_KEY = 'iot_sandbox_widgets';

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
    base.color   = s.color ?? '#0ea5e9';
    base.min     = ds?.min_value ?? 0;
    base.max     = ds?.max_value ?? 100;
    base.unit    = s.unit || ds?.unit || '';
    base.command = 'pwm';
  }
  if (widget.type === 'progressbar') {
    base.color             = s.colorHex || s.color || '#0ea5e9';
    base.colorBasedOnValue = s.colorBasedOnValue || false;
    base.colorThresholds   = s.colorThresholds || [];
    base.gradientMode      = s.gradientMode || 'step';
    base.min               = ds?.min_value ?? 0;
    base.max               = ds?.max_value ?? 100;
    base.unit              = s.unit || ds?.unit || '';
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
    base.color     = s.colorOn || '#22c55e';
    base.ledMode   = s.ledMode || 'binary';
    base.threshold = s.threshold ?? 0.5;
    base.pwmMin    = s.pwmMin ?? 0;
    base.pwmMax    = s.pwmMax ?? 100;
  }
  if (widget.type === 'linechart') {
    base.color      = s.colorHex || '#38bdf8';
    base.xAxisTitle = s.xAxisTitle || '';
    base.yAxisTitle = s.yAxisTitle || '';
  }

  return {
    id:            widget.id,
    type:          widget.type,
    title:         s.title || widget.type,
    data_key:      '__preview__',
    device_id:     null,
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
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/40 rounded-xl p-3 cursor-grab select-none mb-2 transition-colors duration-150"
    >
      <div className="flex items-center gap-2 mb-2">
        <meta.Icon size={13} className="text-sky-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-300">{meta.label}</span>
      </div>
      <div className="flex items-center justify-center min-h-[42px]">
        {Preview && <div className="w-full"><Preview /></div>}
      </div>
      <div className="text-[10px] text-slate-600 mt-1.5">{meta.desc}</div>
    </div>
  );
}

// ── Canvas widget ─────────────────────────────────────────────────────────────

function CanvasWidget({ widget, editMode, onCopy, onDelete, onSettings, datastreamMap }) {
  const [hovered, setHovered] = useState(false);
  const adapted = adaptForRenderer(widget, datastreamMap);
  const mockSensorData = { '__preview__': PREVIEW_VALUES[widget.type] };
  function noop() {}

  return (
    <div
      className="w-full h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <WidgetRenderer
        widget={adapted}
        sensorData={mockSensorData}
        lastEvent={null}
        onCommand={noop}
      />

      {!editMode && (
        <div className="absolute bottom-1 right-1.5 text-[9px] text-slate-700 font-mono font-bold tracking-wide">
          PREVIEW
        </div>
      )}

      {editMode && (
        <div
          className="absolute inset-0 flex items-start justify-end p-1.5 transition-colors duration-150"
          style={{
            background: hovered ? 'rgba(2,10,20,.65)' : 'rgba(2,10,20,.2)',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          <div className={`flex gap-1 transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            <ActionBtn title="Duplicate" onClick={() => onCopy(widget)} icon={Copy} />
            <ActionBtn title="Settings"  onClick={() => onSettings(widget)} icon={Settings} />
            <ActionBtn title="Delete"    onClick={() => onDelete(widget.id)} icon={Trash2} danger />
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ title, onClick, icon: Icon, danger }) {
  return (
    <button
      title={title}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-150
        ${danger
          ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}
    >
      <Icon size={13} />
    </button>
  );
}

// ── Normalize settings ────────────────────────────────────────────────────────

function normalizeSettings(widget, ds) {
  const s = widget.settings || {};
  switch (widget.type) {
    case 'gauge':
      return { ...s, color: s.colorHex || '#38bdf8', min: s.overrideMinMax ? (s.customMin ?? 0) : (ds?.min_value ?? 0), max: s.overrideMinMax ? (s.customMax ?? 100) : (ds?.max_value ?? 100), unit: ds?.unit || '', colorBasedOnValue: s.colorBasedOnValue || false, colorThresholds: s.colorThresholds || [], gradientMode: s.gradientMode || 'step' };
    case 'slider':
      return { ...s, color: s.color ?? '#0ea5e9', min: ds?.min_value ?? 0, max: ds?.max_value ?? 100, unit: s.unit || ds?.unit || '', command: 'pwm' };
    case 'switch':
    case 'button':
      return { ...s, on_value: s.onValue ?? s.on_value ?? '1', off_value: s.offValue ?? s.off_value ?? '0', show_labels: s.showLabels ?? s.show_labels ?? false, on_label: s.onLabel ?? s.on_label ?? 'ON', off_label: s.offLabel ?? s.off_label ?? 'OFF', label_position: s.labelPosition ?? s.label_position ?? 'right', hide_title: s.hideTitle ?? s.hide_title ?? false, command: 'relay' };
    case 'led':
      return { ...s, color: s.colorOn || '#22c55e', colorOff: s.colorOff || '#1e293b', ledMode: s.ledMode || 'binary', threshold: s.threshold ?? 0.5, pwmMin: s.pwmMin ?? 0, pwmMax: s.pwmMax ?? 100 };
    case 'linechart':
      return { ...s, color: s.colorHex || '#38bdf8', xAxisTitle: s.xAxisTitle || '', yAxisTitle: s.yAxisTitle || '' };
    case 'progressbar':
      return { ...s, color: s.colorHex || s.color || '#0ea5e9', colorBasedOnValue: s.colorBasedOnValue || false, colorThresholds: s.colorThresholds || [], gradientMode: s.gradientMode || 'step', min: ds?.min_value ?? 0, max: ds?.max_value ?? 100, unit: s.unit || ds?.unit || '' };
    default:
      return s;
  }
}

// ── Save dialog ───────────────────────────────────────────────────────────────

function SaveDialog({ devices, deviceId, widgets, datastreamMap, onClose }) {
  const navigate              = useNavigate();
  const [existingDashes, setExistingDashes] = useState([]);
  const [mode,   setMode]   = useState('new');   // 'new' | 'overwrite'
  const [name,   setName]   = useState('My Dashboard');
  const [selId,  setSelId]  = useState('');
  const [selDev, setSelDev] = useState(deviceId);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  useEffect(() => {
    api.get('/dashboard').then(r => setExistingDashes(r.data)).catch(() => {});
  }, []);

  async function handleSave() {
    if (mode === 'new' && !name.trim()) return setErr('Dashboard name is required');
    if (mode === 'overwrite' && !selId) return setErr('Select a dashboard to overwrite');
    if (!widgets.length) return setErr('Canvas is empty — add at least one widget');
    setSaving(true); setErr('');
    try {
      let dashId;
      if (mode === 'overwrite') {
        dashId = parseInt(selId);
        // Delete all existing widgets on this dashboard first
        const existing = await api.get(`/dashboard/${dashId}/widgets`).catch(() => ({ data: [] }));
        await Promise.all(existing.data.map(w => api.delete(`/dashboard/widgets/${w.id}`).catch(() => {})));
      } else {
        const { data: dash } = await api.post('/dashboard', { name: name.trim() });
        dashId = dash.id;
      }
      const devId = selDev ? parseInt(selDev) : null;
      for (const w of widgets) {
        const ds      = datastreamMap[w.settings?.datastreamId];
        const dataKey = ds ? `V${ds.virtual_pin}` : null;
        await api.post(`/dashboard/${dashId}/widgets`, {
          type: w.type, title: w.settings?.title || w.type,
          device_id: devId, datastream_id: w.settings?.datastreamId || null,
          data_key: dataKey, x: w.x, y: w.y, w: w.w, h: w.h,
          settings: normalizeSettings(w, ds),
        });
      }
      window.dispatchEvent(new CustomEvent('iot:dashboard-created'));
      navigate(`/dashboard/${dashId}`);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Failed to save dashboard');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Save to Dashboards</h2>
            <p className="text-xs text-slate-500 mt-0.5">{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors"><X size={16} /></button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1.5 mb-4 p-1 bg-slate-800 rounded-lg">
          {[['new','Create New'],['overwrite','Update Existing']].map(([v,l]) => (
            <button key={v} type="button" onClick={() => setMode(v)}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === v ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >{l}</button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {mode === 'new' ? (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Dashboard name</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="e.g. Home Sensors"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Choose dashboard to overwrite</label>
              <select value={selId} onChange={e => setSelId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
              >
                <option value="">— Select dashboard —</option>
                {existingDashes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Bind device <span className="text-slate-600">(for live data)</span></label>
            <select value={selDev} onChange={e => setSelDev(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
            >
              <option value="">— No device —</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}

          <div className="flex gap-2 mt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300 transition-all">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-60 transition-all shadow-lg shadow-sky-500/20"
            >
              <Save size={14} />{saving ? 'Saving…' : mode === 'overwrite' ? 'Overwrite Dashboard' : 'Save Dashboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Template Loader (dropdown with saved server templates) ────────────────────

function TemplateLoader({ onLoad }) {
  const [open,      setOpen]      = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function openDropdown() {
    setOpen(o => !o);
    if (!templates.length) {
      setLoading(true);
      try {
        const r = await api.get('/sandbox');
        setTemplates(r.data);
      } catch {}
      setLoading(false);
    }
  }

  async function loadTemplate(id) {
    try {
      const r = await api.get(`/sandbox/${id}`);
      onLoad(r.data.widgets || []);
      setOpen(false);
    } catch { alert('Failed to load template'); }
  }

  async function deleteTemplate(e, id) {
    e.stopPropagation();
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/sandbox/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch { alert('Failed to delete'); }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openDropdown}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors"
      >
        <FolderOpen size={13} /> Load Template
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Saved Templates</p>
          </div>
          <div className="max-h-52 overflow-y-auto scrollbar-thin">
            {loading && <p className="px-3 py-3 text-xs text-slate-500">Loading…</p>}
            {!loading && !templates.length && (
              <p className="px-3 py-3 text-xs text-slate-600">No templates saved yet.</p>
            )}
            {templates.map(t => (
              <div
                key={t.id}
                onClick={() => loadTemplate(t.id)}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-800 cursor-pointer group transition-colors"
              >
                <div>
                  <p className="text-sm text-slate-200 font-medium">{t.name}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={e => deleteTemplate(e, t.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 rounded transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template Saver (create new OR overwrite existing) ────────────────────────

function TemplateSaver({ widgets }) {
  const [open,      setOpen]      = useState(false);
  const [mode,      setMode]      = useState('new');   // 'new' | 'overwrite'
  const [name,      setName]      = useState('');
  const [selId,     setSelId]     = useState('');
  const [templates, setTemplates] = useState([]);
  const [saving,    setSaving]    = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function openPopover() {
    setOpen(o => !o);
    if (!templates.length) {
      try { const r = await api.get('/sandbox'); setTemplates(r.data); } catch {}
    }
  }

  async function handleSave() {
    if (mode === 'new' && !name.trim()) return;
    if (mode === 'overwrite' && !selId) return;
    setSaving(true);
    try {
      if (mode === 'overwrite') {
        const tpl = templates.find(t => String(t.id) === String(selId));
        await api.post('/sandbox', { name: tpl?.name || selId, widgets });
      } else {
        await api.post('/sandbox', { name: name.trim(), widgets });
        setTemplates(prev => [...prev.filter(t => t.name !== name.trim()), { id: Date.now(), name: name.trim(), created_at: new Date() }]);
      }
      setName('');
      setOpen(false);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to save template');
    }
    setSaving(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPopover}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors"
      >
        <Save size={13} /> Save Template
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Save Template</p>

          {/* Mode toggle */}
          <div className="flex gap-1 p-0.5 bg-slate-800 rounded-lg mb-3">
            {[['new','Create New'],['overwrite','Overwrite']].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setMode(v)}
                className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-all ${mode === v ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >{l}</button>
            ))}
          </div>

          {mode === 'new' ? (
            <input
              autoFocus value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setOpen(false); }}
              placeholder="Template name…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500 transition-all mb-2"
            />
          ) : (
            <select value={selId} onChange={e => setSelId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-500 transition-all mb-2"
            >
              <option value="">— Select template —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}

          <button
            onClick={handleSave}
            disabled={saving || (mode === 'new' ? !name.trim() : !selId)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-50 transition-colors"
          >
            <Save size={13} /> {saving ? 'Saving…' : mode === 'overwrite' ? 'Overwrite' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

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
  const importFileRef   = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const mockData = useMemo(() => {
    const t = tick * 0.5;
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
      id: `w_${Date.now()}`, type,
      x: item.x, y: item.y,
      w: item.w || sz.w, h: item.h || sz.h,
      settings: { ...DEFAULT_SETTINGS[type] },
    }]);
  }

  const duplicateWidget = useCallback((widget) => {
    updateWidgets(prev => [...prev, {
      ...widget,
      id: `w_${Date.now()}`,
      x: Math.min(widget.x + widget.w, 12 - widget.w),
      y: widget.y + widget.h,
    }]);
  }, []);

  const deleteWidget = useCallback((id) => {
    updateWidgets(prev => prev.filter(w => w.id !== id));
  }, []);

  function saveSettings(updated) {
    updateWidgets(prev => prev.map(w => w.id === updated.id ? updated : w));
    setSettingsWidget(null);
  }

  /* ── Export canvas to file ── */
  function handleExportFile() {
    if (!widgets.length) return;
    const payload = {
      _meta: { exported_at: new Date().toISOString(), format: 'iot-platform-sandbox-v1', widget_count: widgets.length },
      widgets: widgets.map(w => ({ ...w, id: undefined })), // strip IDs so import generates fresh ones
    };
    downloadJson(payload, `sandbox_template_${Date.now()}.json`);
  }

  /* ── Import canvas from file ── */
  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const raw     = await readJsonFile(file);
      const entries = Array.isArray(raw) ? raw : (raw.widgets ?? []);
      if (!entries.length) return alert('No widgets found in the file.');
      const imported = entries.map((w, i) => ({ ...w, id: `w_${Date.now()}_${i}`, x: w.x ?? 0, y: w.y ?? 0, w: w.w ?? 3, h: w.h ?? 3 }));
      updateWidgets(imported);
    } catch (err) {
      alert(err.message || 'Failed to import file');
    }
  }

  // Cancel the Layout's p-6 padding so the sandbox fills the viewport edge-to-edge
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const prev = { padding: main.style.padding, overflow: main.style.overflow };
    main.style.padding  = '0';
    main.style.overflow = 'hidden';
    return () => {
      main.style.padding  = prev.padding;
      main.style.overflow = prev.overflow;
    };
  }, []);

  const sz           = droppingType ? (WIDGET_SIZES[droppingType] || { w: 3, h: 3 }) : { w: 3, h: 3 };
  const droppingItem = { i: '__dropping__', w: sz.w, h: sz.h };

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200" style={{ height: '100vh', overflow: 'hidden' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Layers size={14} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Dashboard Sandbox</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {editMode
                ? 'Edit Mode — drag widgets, hover to copy / configure / delete'
                : 'Preview Mode — widgets show realistic mock data'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Device selector */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
            <Cpu size={12} className="text-slate-500" />
            <span className="text-[11px] text-slate-500">Device:</span>
            <select
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              className="bg-transparent border-none text-slate-700 dark:text-slate-300 text-[13px] outline-none cursor-pointer"
            >
              {!devices.length && <option>No devices</option>}
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {widgets.length > 0 && (
            <span className="text-xs text-slate-600 font-mono">
              {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
            </span>
          )}

          {/* ── Export to file ── */}
          <button
            onClick={handleExportFile}
            disabled={!widgets.length}
            title="Export canvas as a .json file you can share"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-30"
            style={{ background: 'rgba(15,118,110,.15)', borderColor: 'rgba(15,118,110,.4)', color: '#2dd4bf' }}
            onMouseEnter={e => { if (widgets.length) e.currentTarget.style.background = 'rgba(15,118,110,.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,118,110,.15)'; }}
          >
            <DownloadIcon size={12} /> Export File
          </button>

          {/* ── Import from file ── */}
          <button
            onClick={() => importFileRef.current?.click()}
            title="Import a .json template file"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{ background: 'rgba(109,40,217,.15)', borderColor: 'rgba(109,40,217,.4)', color: '#c4b5fd' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(109,40,217,.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(109,40,217,.15)'; }}
          >
            <Upload size={12} /> Import File
          </button>
          <input ref={importFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportFile} />

          {/* Template: Load dropdown */}
          <TemplateLoader onLoad={updateWidgets} />

          {/* Template: Save to server */}
          <TemplateSaver widgets={widgets} />

          {widgets.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Clear all widgets?')) updateWidgets([]); }}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Clear
            </button>
          )}

          {widgets.length > 0 && (
            <button
              onClick={() => setSaveDialog(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 border border-sky-400/30 transition-all shadow-lg shadow-sky-500/20"
            >
              <Save size={14} />
              Save to Dashboards
            </button>
          )}

          {/* Edit / Preview toggle */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg p-1">
            <button
              onClick={() => setEditMode(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${!editMode ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-400'}`}
            >
              <Eye size={12} /> Preview
            </button>
            <button
              onClick={() => setEditMode(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${editMode ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-500 hover:text-slate-400'}`}
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* ── Workspace ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Widget Drawer */}
        <div
          className="shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-250"
          style={{ width: editMode ? 188 : 0 }}
        >
          {editMode && (
            <div className="flex flex-col h-full">
              <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-600 uppercase tracking-widest">Widget Box</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-700 mt-0.5 flex items-center gap-1">
                  Drag onto canvas <ChevronRight size={10} />
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-2.5 scrollbar-thin">
                {WIDGET_META.map(meta => (
                  <DrawerItem key={meta.type} meta={meta} onDragStart={handleDragStart} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div ref={canvasRef} className="flex-1 overflow-y-auto p-4 relative min-w-0">
          {!widgets.length && (
            <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl m-2 py-20">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4">
                {editMode
                  ? <ChevronRight size={24} className="text-slate-600" />
                  : <Layers size={24} className="text-slate-600" />
                }
              </div>
              <p className="font-semibold text-slate-500 text-sm">
                {editMode ? 'Drag widgets from the panel' : 'Canvas is empty'}
              </p>
              <p className="text-xs text-slate-700 mt-1.5">
                {editMode ? 'Drop anywhere on this grid' : 'Toggle Edit Mode to start building'}
              </p>
            </div>
          )}

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

        {/* Config Panel */}
        <div
          className="shrink-0 overflow-hidden transition-all duration-250 flex"
          style={{ width: settingsWidget ? 320 : 0 }}
        >
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
        <div className="bg-sky-500/10 border-t border-sky-500/20 px-5 py-2 flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-bold text-sky-500 dark:text-sky-400">EDIT MODE</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-600">Drag · Resize corners · Hover widget for Copy / Settings / Delete</span>
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
