import React, { useState, useEffect } from 'react';
import { Section, JsonPreview } from './GaugeSettings';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';

const MOCK_DATA = Array.from({ length: 20 }, (_, i) => ({
  t: `${i}s`,
  v: 40 + Math.sin(i * 0.6) * 20 + Math.random() * 8,
}));

const TIME_WINDOWS = [
  { label: 'Live',  value: 'live' },
  { label: '1 h',   value: '1h'   },
  { label: '6 h',   value: '6h'   },
  { label: '24 h',  value: '24h'  },
  { label: '7 d',   value: '7d'   },
];

const CHART_TYPES = [
  { label: 'Line', value: 'line', icon: '📈' },
  { label: 'Area', value: 'area', icon: '🏔' },
  { label: 'Bar',  value: 'bar',  icon: '📊' },
];

function ChartPreview({ chartType, color }) {
  const commonProps = {
    data: MOCK_DATA,
    margin: { top: 4, right: 8, bottom: 0, left: -18 },
  };
  const tooltipStyle = {
    contentStyle: { background: '#0f172a', border: '1px solid #334155', fontSize: 11, borderRadius: 6 },
  };
  const axisProps = { tick: { fill: '#475569', fontSize: 9 }, interval: 4 };

  const chart = (() => {
    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="v" stroke={color} fill="url(#grad)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <XAxis dataKey="t" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        );
      default:
        return (
          <LineChart {...commonProps}>
            <XAxis dataKey="t" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 3 }} />
          </LineChart>
        );
    }
  })();

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="text-xs text-slate-500 mb-3 text-center">Chart Preview</div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ToggleField({ label, hint, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-800 last:border-0">
      <div>
        <div className="text-sm text-slate-200">{label}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-11 h-6 rounded-full border-2 transition-all ${
          value ? 'bg-sky-500 border-sky-500' : 'bg-slate-800 border-slate-700'
        }`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default function ChartSettings({ datastreams, initialConfig = {}, onChange }) {
  const [cfg, setCfg] = useState({
    title:      '',
    datastreamId: '',
    chartType:  'line',
    timeWindow: 'live',
    colorHex:   '#38bdf8',
    showDots:   false,
    smoothCurve: true,
    ...initialConfig,
  });

  useEffect(() => { onChange?.(cfg); }, [cfg]);

  function set(k, v) { setCfg(p => ({ ...p, [k]: v })); }

  const ds = datastreams.find(d => String(d.id) === String(cfg.datastreamId));

  return (
    <div className="space-y-6">
      {/* Preview */}
      <ChartPreview chartType={cfg.chartType} color={cfg.colorHex} />

      {/* Widget */}
      <Section title="Widget">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Title</label>
            <input
              type="text" value={cfg.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Temperature History"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Datastream</label>
            <select
              value={cfg.datastreamId}
              onChange={e => set('datastreamId', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-600"
            >
              <option value="">— select datastream —</option>
              {datastreams.filter(d => d.data_type !== 'string').map(d => (
                <option key={d.id} value={d.id}>
                  V{d.virtual_pin} · {d.display_name} ({d.data_type})
                </option>
              ))}
            </select>
            {ds && (
              <div className="mt-2 text-xs text-slate-600 font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
                unit: <span className="text-slate-300">{ds.unit || '—'}</span>
                {' · '}range: <span className="text-slate-300">{ds.min_value ?? '—'} → {ds.max_value ?? '—'}</span>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Chart Type */}
      <Section title="Chart Type">
        <div className="grid grid-cols-3 gap-2">
          {CHART_TYPES.map(ct => (
            <button
              key={ct.value}
              type="button"
              onClick={() => set('chartType', ct.value)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-sm transition-all ${
                cfg.chartType === ct.value
                  ? 'border-sky-600 bg-sky-900/30 text-sky-300 font-semibold'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
              }`}
            >
              <span className="text-xl">{ct.icon}</span>
              <span className="text-xs">{ct.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Time Window */}
      <Section title="Time Window">
        <div className="flex gap-1.5 flex-wrap">
          {TIME_WINDOWS.map(tw => (
            <button
              key={tw.value}
              type="button"
              onClick={() => set('timeWindow', tw.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                cfg.timeWindow === tw.value
                  ? 'bg-sky-900/40 border-sky-600 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {tw.label}
            </button>
          ))}
        </div>
        {cfg.timeWindow === 'live' && (
          <p className="text-xs text-sky-700 mt-2">Live mode appends data in real-time via WebSocket — buffer capped at 120 points.</p>
        )}
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Color</label>
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 shrink-0">
                <div className="w-9 h-9 rounded-lg border border-slate-700" style={{ background: cfg.colorHex }} />
                <input type="color" value={cfg.colorHex} onChange={e => set('colorHex', e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
              </div>
              <span className="text-sm text-slate-400 font-mono">{cfg.colorHex}</span>
            </div>
          </div>
        </div>
        <ToggleField label="Show Data Points" hint="Render individual dots at each data sample" value={cfg.showDots} onChange={v => set('showDots', v)} />
        <ToggleField label="Smooth Curve" hint="Monotone interpolation between points" value={cfg.smoothCurve} onChange={v => set('smoothCurve', v)} />
      </Section>

      <JsonPreview data={{
        type:        'chart',
        title:       cfg.title,
        datastreamId: cfg.datastreamId,
        chartType:   cfg.chartType,
        timeWindow:  cfg.timeWindow,
        colorHex:    cfg.colorHex,
        showDots:    cfg.showDots,
        smoothCurve: cfg.smoothCurve,
      }} />
    </div>
  );
}
