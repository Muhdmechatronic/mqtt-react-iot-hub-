import React, { useEffect, useState } from 'react';
import api from '../services/api';
import SwitchWidgetSettings, { buildSwitchSettings } from './SwitchWidgetSettings';
import {
  AreaChart, Target, Hash, BarChart2, Lightbulb,
  ToggleRight, SlidersHorizontal, Square, X, Check,
} from 'lucide-react';

const TYPES = [
  { key: 'linechart',   label: 'Chart',         Icon: AreaChart,         defaultW: 6, defaultH: 4 },
  { key: 'gauge',       label: 'Gauge',          Icon: Target,            defaultW: 3, defaultH: 3 },
  { key: 'label',       label: 'Value Display',  Icon: Hash,              defaultW: 3, defaultH: 2 },
  { key: 'progressbar', label: 'Progress Bar',   Icon: BarChart2,         defaultW: 4, defaultH: 2 },
  { key: 'led',         label: 'LED Indicator',  Icon: Lightbulb,         defaultW: 2, defaultH: 2 },
  { key: 'switch',      label: 'Toggle',         Icon: ToggleRight,       defaultW: 2, defaultH: 2 },
  { key: 'slider',      label: 'Slider',         Icon: SlidersHorizontal, defaultW: 4, defaultH: 2 },
  { key: 'button',      label: 'Push Button',    Icon: Square,            defaultW: 2, defaultH: 2 },
];

const UNIT_HINTS = [
  '°C','°F','%','hPa','Pa','lux','ppm',
  'V','mV','A','mA','W','kW','kWh',
  'm','cm','mm','km','kg','g',
  'm/s','km/h','rpm','pH','dB',
];

const HAS_RANGE   = new Set(['gauge','slider','progressbar']);
const HAS_COMMAND = new Set(['switch','slider','button']);
const HAS_SENSOR  = new Set(['linechart','gauge','label','progressbar','led','slider']);
const HAS_UNIT    = new Set(['linechart','gauge','label','progressbar','slider']);

const inp = {
  display: 'block', width: '100%', padding: '9px 12px',
  background: 'transparent', border: '1px solid #334155',
  borderRadius: 6, color: 'inherit', fontSize: 14, boxSizing: 'border-box',
};

const DEFAULT_THRESHOLDS = [
  { id: 1, threshold: 0,  colorHex: '#22c55e' },
  { id: 2, threshold: 60, colorHex: '#f59e0b' },
  { id: 3, threshold: 80, colorHex: '#ef4444' },
];

function emptyForm(type = 'gauge') {
  return {
    type, title: '', device_id: '', datastream_id: '', data_key: '', unit: '',
    color: '#38bdf8', min: '0', max: '100', threshold: '0.5', command: '', buttonLabel: '',
    chartType: 'area', xAxisTitle: '', yAxisTitle: '',
    colorBasedOnValue: false, colorThresholds: [], gradientMode: 'step',
    sw_on_value: '1', sw_off_value: '0', sw_show_labels: false,
    sw_on_label: 'ON', sw_off_label: 'OFF', sw_label_position: 'right', sw_hide_title: false,
  };
}

function widgetToForm(w) {
  const sj = w.settings_json || {};
  return {
    type:              w.type,
    title:             w.title              || '',
    device_id:         String(w.device_id   || ''),
    datastream_id:     String(w.datastream_id || ''),
    data_key:          w.data_key           || '',
    unit:              sj.unit              ?? '',
    color:             sj.color             ?? '#38bdf8',
    min:               String(sj.min        ?? 0),
    max:               String(sj.max        ?? 100),
    threshold:         String(sj.threshold  ?? 0.5),
    command:           sj.command           ?? '',
    buttonLabel:       sj.label             ?? '',
    chartType:         sj.chartType         ?? 'area',
    xAxisTitle:        sj.xAxisTitle        ?? '',
    yAxisTitle:        sj.yAxisTitle        ?? '',
    colorBasedOnValue: sj.colorBasedOnValue ?? false,
    colorThresholds:   sj.colorThresholds   ?? [],
    gradientMode:      sj.gradientMode      ?? 'step',
    sw_on_value:       sj.on_value          ?? '1',
    sw_off_value:      sj.off_value         ?? '0',
    sw_show_labels:    sj.show_labels       ?? false,
    sw_on_label:       sj.on_label          ?? 'ON',
    sw_off_label:      sj.off_label         ?? 'OFF',
    sw_label_position: sj.label_position    ?? 'right',
    sw_hide_title:     sj.hide_title        ?? false,
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
  if (form.type === 'linechart') {
    base.chartType  = form.chartType  || 'area';
    base.xAxisTitle = form.xAxisTitle || '';
    base.yAxisTitle = form.yAxisTitle || '';
  }
  if ((form.type === 'gauge' || form.type === 'progressbar') && form.colorBasedOnValue) {
    base.colorBasedOnValue = true;
    base.colorThresholds   = form.colorThresholds || DEFAULT_THRESHOLDS;
    base.gradientMode      = form.gradientMode || 'step';
  }
  return base;
}

// ── Inline threshold editor (gauge + progressbar in dashboard WidgetModal) ────

function ThresholdEditor({ thresholds, mode, onChangeThresholds, onChangeMode }) {
  const stops  = thresholds?.length ? thresholds : DEFAULT_THRESHOLDS;
  const sorted = [...stops].sort((a, b) => a.threshold - b.threshold);

  // Step preview: sharp blocks; smooth preview: gradient
  const previewGradient = sorted.length < 2
    ? sorted[0]?.colorHex ?? '#38bdf8'
    : mode === 'step'
      ? `linear-gradient(to right, ${sorted.map((s, i) => `${s.colorHex} ${(i/sorted.length*100).toFixed(1)}%, ${s.colorHex} ${((i+1)/sorted.length*100).toFixed(1)}%`).join(', ')})`
      : `linear-gradient(to right, ${sorted.map(s => s.colorHex).join(', ')})`;

  function update(idx, updated) {
    const next = stops.map((s, i) => i === idx ? updated : s);
    onChangeThresholds(next);
  }
  function add()       { onChangeThresholds([...stops, { id: Date.now(), threshold: 0, colorHex: '#38bdf8' }]); }
  function remove(idx) { if (stops.length > 1) onChangeThresholds(stops.filter((_, i) => i !== idx)); }

  return (
    <div>
      <div className="h-2.5 rounded-full mb-3" style={{ background: previewGradient }} />
      <div className="flex gap-1.5 mb-3">
        {['step','smooth'].map(m => (
          <button key={m} type="button" onClick={() => onChangeMode(m)}
            className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-all capitalize
              ${mode === m
                ? 'bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400'
                : 'bg-transparent border-slate-300 dark:border-slate-600 text-slate-500 hover:border-slate-400'}`}
          >{m}</button>
        ))}
      </div>
      {stops.map((stop, idx) => (
        <div key={stop.id ?? idx} className="flex items-center gap-2 mb-2">
          <input type="color" value={stop.colorHex}
            onChange={e => update(idx, { ...stop, colorHex: e.target.value })}
            className="w-7 h-7 rounded border-none bg-transparent cursor-pointer p-0"
          />
          <span className="text-xs text-slate-500">≥</span>
          <input type="number" value={stop.threshold}
            onChange={e => update(idx, { ...stop, threshold: parseFloat(e.target.value) || 0 })}
            className="flex-1 px-2 py-1.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 outline-none focus:border-sky-500 transition-all"
          />
          {stops.length > 1 && (
            <button type="button" onClick={() => remove(idx)}
              className="text-slate-400 hover:text-red-400 transition-colors px-1"
            >✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-sky-500 hover:text-sky-400 transition-colors">
        + Add color stop
      </button>
    </div>
  );
}

export default function WidgetModal({ dashboardId, widget, onClose, onSaved }) {
  const isEdit = Boolean(widget);
  const [form,        setForm]        = useState(isEdit ? widgetToForm(widget) : emptyForm());
  const [devices,     setDevices]     = useState([]);
  const [datastreams, setDatastreams] = useState([]);
  const [saving,      setSaving]      = useState(false);

  // Prevent background page scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    api.get('/device/list').then(r => setDevices(r.data)).catch(() => {});
  }, []);

  // Load datastreams when device changes
  useEffect(() => {
    if (!form.device_id) { setDatastreams([]); return; }
    api.get(`/datastream?device_id=${form.device_id}`)
      .then(r => setDatastreams(r.data))
      .catch(() => setDatastreams([]));
  }, [form.device_id]);

  // Auto-fill unit from selected datastream
  useEffect(() => {
    if (!form.datastream_id || !datastreams.length) return;
    const ds = datastreams.find(d => String(d.id) === String(form.datastream_id));
    if (ds?.unit) setForm(f => ({ ...f, unit: ds.unit, data_key: `V${ds.virtual_pin}` }));
    else if (ds) setForm(f => ({ ...f, data_key: `V${ds.virtual_pin}` }));
  }, [form.datastream_id, datastreams]);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }
  function onChange(e)   { set(e.target.name, e.target.value); }

  function pickType(key) {
    setForm(f => ({ ...emptyForm(key), title: f.title, device_id: f.device_id, datastream_id: f.datastream_id, data_key: f.data_key, unit: f.unit }));
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
          ...payload, x: 0, y: 0, w: defaultW ?? 3, h: defaultH ?? 3,
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
  const showChart     = form.type === 'linechart';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[200] overflow-y-auto py-4 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-[460px] shadow-2xl my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {isEdit ? 'Edit Widget' : 'Add Widget'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form className="px-6 py-4" onSubmit={handleSubmit}>
          {/* Type picker */}
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Widget Type</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pickType(t.key)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all duration-150
                    ${form.type === t.key
                      ? 'border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                  <t.Icon size={18} />
                  <span className="text-[11px] font-medium leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Switch: dedicated panel */}
          {form.type === 'switch' && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-700 my-3" />
              <SwitchWidgetSettings form={form} set={set} devices={devices} />
              <div className="border-t border-slate-200 dark:border-slate-700 my-3" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-60 transition-colors">
                  <Check size={14} />{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Widget'}
                </button>
              </div>
            </>
          )}

          {form.type !== 'switch' && (<>
          <div className="border-t border-slate-200 dark:border-slate-700 my-3" />

          {/* Title */}
          <div className="mb-3">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Title</label>
            <input name="title" style={inp} value={form.title} onChange={onChange} required placeholder="Widget title"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
            />
          </div>

          {/* Device + Datastream */}
          <div className="mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Device</label>
                <select name="device_id" value={form.device_id} onChange={onChange}
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                >
                  <option value="">-- none --</option>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {showSensor && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Datastream</label>
                  <select name="datastream_id" value={form.datastream_id} onChange={onChange} disabled={!form.device_id}
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50 transition-all"
                  >
                    <option value="">-- select --</option>
                    {datastreams.map(ds => (
                      <option key={ds.id} value={ds.id}>
                        V{ds.virtual_pin} · {ds.display_name}{ds.unit ? ` (${ds.unit})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-3" />

          {/* Unit + Color */}
          <div className="mb-3">
            <div className="grid grid-cols-2 gap-3">
              {showUnit && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Unit</label>
                  <input name="unit" list="wm-units" value={form.unit} onChange={onChange} placeholder="e.g. °C"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                  />
                  <datalist id="wm-units">{UNIT_HINTS.map(u => <option key={u} value={u} />)}</datalist>
                </div>
              )}
              {/* Hide plain color picker when threshold mode is active */}
              {!(form.colorBasedOnValue && (form.type === 'gauge' || form.type === 'progressbar')) && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer bg-slate-50 dark:bg-slate-800 p-1"
                    />
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{form.color}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Color Based on Value (gauge + progressbar) */}
          {(form.type === 'gauge' || form.type === 'progressbar') && (
            <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Color Based on Value</span>
                <button type="button" onClick={() => {
                  const next = !form.colorBasedOnValue;
                  set('colorBasedOnValue', next);
                  if (next && !form.colorThresholds?.length) {
                    set('colorThresholds', DEFAULT_THRESHOLDS.map(t => ({ ...t, id: Date.now() + t.id })));
                    set('gradientMode', 'step');
                  }
                }}
                  className={`relative w-9 h-5 rounded-full border transition-all ${form.colorBasedOnValue ? 'bg-sky-500 border-sky-400' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.colorBasedOnValue ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
              {form.colorBasedOnValue && (
                <ThresholdEditor
                  thresholds={form.colorThresholds}
                  mode={form.gradientMode ?? 'step'}
                  onChangeThresholds={v => set('colorThresholds', v)}
                  onChangeMode={v => set('gradientMode', v)}
                />
              )}
            </div>
          )}

          {/* LED threshold */}
          {showThreshold && (
            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">ON Threshold (value ≥ this → LED ON)</label>
              <input name="threshold" type="number" step="any" value={form.threshold} onChange={onChange}
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
              />
            </div>
          )}

          {/* Range */}
          {showRange && (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Min</label>
                <input name="min" type="number" value={form.min} onChange={onChange}
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Max</label>
                <input name="max" type="number" value={form.max} onChange={onChange}
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* Chart-specific settings */}
          {showChart && (
            <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Chart Settings</p>
              <div className="mb-3">
                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Chart Type</label>
                <div className="flex gap-2">
                  {['line','area','bar'].map(ct => (
                    <button key={ct} type="button" onClick={() => set('chartType', ct)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize
                        ${form.chartType === ct
                          ? 'bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 hover:border-slate-400 dark:hover:border-slate-500'}`}
                    >{ct}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">X-Axis Label</label>
                  <input name="xAxisTitle" value={form.xAxisTitle} onChange={onChange} placeholder="e.g. Time"
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Y-Axis Label</label>
                  <input name="yAxisTitle" value={form.yAxisTitle} onChange={onChange} placeholder="e.g. Temp (°C)"
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Command */}
          {showCommand && (
            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Command name</label>
              <input name="command" value={form.command} onChange={onChange}
                placeholder={form.type === 'slider' ? 'pwm' : 'toggle'}
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
              />
              {form.type === 'button' && (
                <>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-3 mb-1.5">Button label</label>
                  <input name="buttonLabel" value={form.buttonLabel} onChange={onChange} placeholder={form.title || 'Press'}
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                  />
                </>
              )}
            </div>
          )}

          <div className="border-t border-slate-200 dark:border-slate-700 my-3" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-60 transition-colors shadow-lg shadow-sky-500/20"
            >
              <Check size={14} />{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Widget'}
            </button>
          </div>
          </>)}
        </form>
      </div>
    </div>
  );
}
