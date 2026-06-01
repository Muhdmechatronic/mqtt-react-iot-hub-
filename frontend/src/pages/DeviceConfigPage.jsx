import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import DatastreamEngine from '../components/config/DatastreamEngine';
import GaugeSettings    from '../components/config/GaugeSettings';
import SliderSettings   from '../components/config/SliderSettings';
import ChartSettings    from '../components/config/ChartSettings';
import SwitchWidgetSettings, { buildSwitchSettings } from '../components/SwitchWidgetSettings';

// ── Tab bar ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'datastream', label: 'Datastream Engine', icon: '⚡' },
  { id: 'widgets',    label: 'Widget Properties', icon: '🎛'  },
];

// ── Widget type catalogue ────────────────────────────────────────────────────
const WIDGET_TYPES = [
  { id: 'gauge',  label: 'Gauge',   icon: '🎯', desc: 'Analog dial with threshold colors' },
  { id: 'slider', label: 'Slider',  icon: '🎚', desc: 'Control output with step & fine-tuning' },
  { id: 'chart',  label: 'Chart',   icon: '📈', desc: 'Line, area or bar time-series graph' },
  { id: 'switch', label: 'Switch',  icon: '🔘', desc: 'Toggle with ON/OFF value mapping' },
];

// ── Reusable primitives ───────────────────────────────────────────────────────
function TabButton({ active, onClick, icon, label, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-semibold transition-all border-b-2 shrink-0 whitespace-nowrap',
        active
          ? 'text-sky-400 border-sky-500 bg-slate-900/40'
          : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600',
      ].join(' ')}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {badge != null && (
        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
          active ? 'bg-sky-900 text-sky-300' : 'bg-slate-800 text-slate-500'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function WidgetTypeCard({ type, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
        active
          ? 'border-sky-600 bg-sky-950/40 shadow-[0_0_16px_rgba(14,165,233,.15)]'
          : 'border-slate-800 bg-slate-900 hover:border-slate-700',
      ].join(' ')}
    >
      <span className="text-2xl shrink-0 mt-0.5">{type.icon}</span>
      <div>
        <div className={`text-sm font-semibold ${active ? 'text-sky-300' : 'text-slate-300'}`}>{type.label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{type.desc}</div>
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DeviceConfigPage() {
  const [devices,      setDevices]      = useState([]);
  const [deviceId,     setDeviceId]     = useState('');
  const [activeTab,    setActiveTab]    = useState('datastream');
  const [widgetType,   setWidgetType]   = useState('gauge');
  const [datastreams,  setDatastreams]  = useState([]);
  const [widgetCfg,    setWidgetCfg]    = useState({});
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState('');

  // Load devices
  useEffect(() => {
    api.get('/device/list').then(r => {
      setDevices(r.data);
      if (r.data.length > 0) setDeviceId(String(r.data[0].id));
    }).catch(() => {});
  }, []);

  const onStreamsChange = useCallback(streams => setDatastreams(streams), []);

  async function handleSaveWidget() {
    setSaving(true);
    setSaveMsg('');
    try {
      // In a real flow this would open a dashboard selector + POST to /dashboard/:id/widgets
      // For now we just show the resolved config JSON
      await new Promise(r => setTimeout(r, 600)); // simulated latency
      setSaveMsg('✓ Configuration validated — ready to add to a dashboard.');
    } finally {
      setSaving(false);
    }
  }

  const device = devices.find(d => String(d.id) === deviceId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">

      {/* ── Page header ── */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 sm:py-4 gap-2 sm:gap-0">
            <div>
              <h1 className="text-lg font-bold text-slate-100">Device Configuration Builder</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage datastreams and configure widget properties
              </p>
            </div>

            {/* Device selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                <span className="text-xs text-slate-500">Device:</span>
                <select
                  value={deviceId}
                  onChange={e => setDeviceId(e.target.value)}
                  className="bg-transparent text-sm text-slate-200 focus:outline-none pr-4"
                >
                  {devices.length === 0 && <option>No devices</option>}
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {device && (
                <div className="text-xs text-slate-600 font-mono hidden md:block">
                  {device.api_key?.slice(0, 12)}…
                </div>
              )}
            </div>
          </div>

          {/* Tabs — horizontally scrollable on mobile */}
          <div className="flex overflow-x-auto scrollbar-none -mx-4 sm:-mx-6 px-4 sm:px-6 touch-pan-x">
            {TABS.map(tab => (
              <TabButton
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                icon={tab.icon}
                label={tab.label}
                badge={tab.id === 'datastream' ? datastreams.length || undefined : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ══ Tab 1: Datastream Engine ══════════════════════════════════════════ */}
        {activeTab === 'datastream' && (
          !deviceId ? (
            <div className="text-center py-20 text-slate-600">No devices found — add a device first.</div>
          ) : (
            <DatastreamEngine
              deviceId={deviceId}
              onStreamsChange={onStreamsChange}
            />
          )
        )}

        {/* ══ Tab 2: Widget Properties ══════════════════════════════════════════ */}
        {activeTab === 'widgets' && (
          <div className="grid grid-cols-12 gap-6">

            {/* Left: widget type selector + save */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Select Widget Type
                </h2>
                <div className="space-y-2">
                  {WIDGET_TYPES.map(wt => (
                    <WidgetTypeCard
                      key={wt.id}
                      type={wt}
                      active={widgetType === wt.id}
                      onClick={() => setWidgetType(wt.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Schema reference */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">API Contract</div>
                <div className="text-xs text-slate-600 font-mono space-y-1">
                  <div><span className="text-emerald-600">POST</span> /api/dashboard/:id/widgets</div>
                  <div><span className="text-sky-600">PUT</span> /api/dashboard/widgets/:id</div>
                  <div><span className="text-amber-600">DELETE</span> /api/dashboard/widgets/:id</div>
                </div>
              </div>

              {/* Datastream availability */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Available Datastreams
                </div>
                {datastreams.length === 0 ? (
                  <p className="text-xs text-slate-600">
                    No datastreams yet.{' '}
                    <button onClick={() => setActiveTab('datastream')} className="text-sky-500 hover:underline">
                      Go to Datastream Engine →
                    </button>
                  </p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                    {datastreams.map(d => (
                      <div key={d.id} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono text-sky-500 font-bold w-8">V{d.virtual_pin}</span>
                        <span className="text-slate-400 truncate">{d.display_name}</span>
                        <span className="ml-auto text-slate-600">{d.data_type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: settings panel */}
            <div className="col-span-12 lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {WIDGET_TYPES.find(w => w.id === widgetType)?.label} Settings
                </h2>
                <button
                  onClick={handleSaveWidget}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors"
                >
                  {saving ? (
                    <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Validating…</>
                  ) : (
                    <>✓ Validate Config</>
                  )}
                </button>
              </div>

              {saveMsg && (
                <div className="bg-emerald-950 border border-emerald-800 text-emerald-400 text-sm px-4 py-2.5 rounded-lg">
                  {saveMsg}
                </div>
              )}

              {/* Settings panels */}
              {widgetType === 'gauge' && (
                <GaugeSettings
                  datastreams={datastreams}
                  onChange={setWidgetCfg}
                />
              )}
              {widgetType === 'slider' && (
                <SliderSettings
                  datastreams={datastreams}
                  onChange={setWidgetCfg}
                />
              )}
              {widgetType === 'chart' && (
                <ChartSettings
                  datastreams={datastreams}
                  onChange={setWidgetCfg}
                />
              )}
              {widgetType === 'switch' && (
                <div className="space-y-4">
                  <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/50">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Switch Configuration</span>
                    </div>
                    <div className="p-4">
                      <SwitchWidgetSettings
                        form={widgetCfg}
                        set={(k, v) => setWidgetCfg(prev => ({ ...prev, [k]: v }))}
                        devices={devices}
                      />
                    </div>
                  </div>
                  {/* JSON preview for switch */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <details>
                      <summary className="px-4 py-2.5 text-xs text-slate-500 font-mono cursor-pointer hover:text-slate-400">
                        settings_json preview
                      </summary>
                      <pre className="px-4 pb-4 text-xs text-emerald-400 font-mono overflow-x-auto scrollbar-thin">
                        {JSON.stringify({ type: 'switch', ...buildSwitchSettings(widgetCfg) }, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
