import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const UNIT_GROUPS = [
  { label: 'None',          units: ['(none)'] },
  { label: 'Temperature',   units: ['°C', '°F', 'K'] },
  { label: 'Distance',      units: ['m', 'cm', 'mm', 'km', 'mi', 'yd', 'ft', 'in'] },
  { label: 'Speed',         units: ['m/s', 'km/h', 'mph', 'knots'] },
  { label: 'Power',         units: ['W', 'kW', 'MW', 'hp'] },
  { label: 'Energy',        units: ['J', 'kJ', 'Wh', 'kWh', 'MWh'] },
  { label: 'Current',       units: ['A', 'mA', 'μA'] },
  { label: 'Voltage',       units: ['V', 'mV', 'kV'] },
  { label: 'Percentage',    units: ['%', '%RH'] },
  { label: 'Pressure',      units: ['Pa', 'hPa', 'kPa', 'bar', 'psi'] },
  { label: 'Concentration', units: ['ppm', 'ppb', 'mg/m³'] },
  { label: 'Mass',          units: ['kg', 'g', 'mg', 'lb'] },
  { label: 'Time',          units: ['s', 'ms', 'min', 'h', 'day'] },
  { label: 'Light',         units: ['lux', 'lm'] },
  { label: 'Other',         units: ['pH', 'dB', 'pcs'] },
];

const TYPE_STYLE = {
  integer: { bg: 'bg-sky-950 border-sky-800',  text: 'text-sky-400'   },
  double:  { bg: 'bg-emerald-950 border-emerald-800', text: 'text-emerald-400' },
  string:  { bg: 'bg-amber-950 border-amber-800',   text: 'text-amber-400'  },
};

// ── Inline edit drawer ─────────────────────────────────────────────────────────
function EditDrawer({ pin, existing, deviceId, takenPins, onClose, onSaved }) {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState({
    name:          existing?.name          || '',
    display_name:  existing?.display_name  || '',
    data_type:     existing?.data_type     || 'double',
    unit:          existing?.unit          || '(none)',
    min_value:     existing?.min_value !== null && existing?.min_value !== undefined ? String(existing.min_value) : '',
    max_value:     existing?.max_value !== null && existing?.max_value !== undefined ? String(existing.max_value) : '',
    default_value: existing?.default_value || '',
  });
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isString = form.data_type === 'string';

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim())        { setError('Name required'); return; }
    if (!form.display_name.trim()){ setError('Display Name required'); return; }
    if (!isEdit && takenPins.has(pin)) { setError(`V${pin} is already taken`); return; }
    if (!isString && form.min_value !== '' && form.max_value !== '' &&
        parseFloat(form.min_value) >= parseFloat(form.max_value)) {
      setError('Max must be greater than Min');
      return;
    }
    setError(''); setSaving(true);
    const payload = {
      device_id: deviceId, virtual_pin: pin,
      name: form.name.trim(), display_name: form.display_name.trim(),
      data_type: form.data_type,
      unit: form.unit === '(none)' ? null : form.unit,
      min_value: isString ? null : (form.min_value === '' ? null : form.min_value),
      max_value: isString ? null : (form.max_value === '' ? null : form.max_value),
      default_value: form.default_value || null,
    };
    try {
      if (isEdit) await api.put(`/datastream/${existing.id}`, payload);
      else        await api.post('/datastream', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  }

  const inp = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-600 transition-colors';
  const lbl = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-xl p-5 space-y-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono text-sky-400 font-bold">V{pin}</span>
          <span className="ml-2 text-sm font-semibold text-slate-200">
            {isEdit ? 'Edit Datastream' : 'New Datastream'}
          </span>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-400 text-lg leading-none transition-colors">×</button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Name + Display Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Name <span className="normal-case text-slate-600">(identifier)</span></label>
            <input className={inp} value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. temperature" pattern="[a-zA-Z0-9_]+" required />
          </div>
          <div>
            <label className={lbl}>Display Name</label>
            <input className={inp} value={form.display_name} onChange={e => set('display_name', e.target.value)}
              placeholder="e.g. Room Temp" required />
          </div>
        </div>

        {/* Data Type + Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Data Type</label>
            <select className={inp} value={form.data_type} onChange={e => set('data_type', e.target.value)}>
              <option value="integer">Integer</option>
              <option value="double">Double</option>
              <option value="string">String</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Unit</label>
            <select className={`${inp} ${isString ? 'opacity-40 cursor-not-allowed' : ''}`}
              value={form.unit} onChange={e => set('unit', e.target.value)} disabled={isString}>
              {UNIT_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.units.map(u => <option key={u} value={u}>{u}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Min / Max / Default */}
        <div className="grid grid-cols-3 gap-2">
          {['min_value','max_value','default_value'].map((k, i) => (
            <div key={k}>
              <label className={lbl}>{['Min', 'Max', 'Default'][i]}</label>
              <input type={i < 2 ? 'number' : 'text'} step="any"
                className={`${inp} font-mono ${isString && i < 2 ? 'opacity-40' : ''}`}
                value={form[k]} onChange={e => set(k, e.target.value)}
                disabled={isString && i < 2}
                placeholder={isString && i < 2 ? '—' : ['0', '100', '0'][i]}
              />
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Pin Grid ──────────────────────────────────────────────────────────────────
function PinGrid({ streams, onSelect, selectedPin }) {
  const pinMap = new Map(streams.map(s => [s.virtual_pin, s]));
  const COLS = 16;

  return (
    <div className="overflow-x-auto scrollbar-thin pb-2">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(44px, 1fr))`, minWidth: 720 }}
      >
        {Array.from({ length: 256 }, (_, pin) => {
          const ds       = pinMap.get(pin);
          const active   = Boolean(ds);
          const selected = selectedPin === pin;
          const typeKey  = ds?.data_type;
          const ts       = TYPE_STYLE[typeKey] || {};

          return (
            <button
              key={pin}
              type="button"
              onClick={() => onSelect(pin)}
              title={ds ? `${ds.display_name} (${ds.data_type})` : `V${pin} — empty`}
              className={[
                'relative group flex flex-col items-center justify-center rounded-md border transition-all duration-150 py-1.5 px-0.5 text-[10px] font-mono',
                selected ? 'ring-2 ring-sky-500 ring-offset-1 ring-offset-slate-950 scale-105 z-10' : '',
                active
                  ? `${ts.bg} ${ts.text} hover:brightness-125 cursor-pointer`
                  : 'bg-slate-900 border-slate-800 text-slate-700 hover:border-slate-600 hover:text-slate-500 cursor-pointer',
              ].join(' ')}
            >
              <span className={`font-bold ${active ? '' : 'text-slate-800'}`}>V{pin}</span>
              {ds && (
                <span className="text-[8px] truncate w-full text-center leading-tight mt-0.5 opacity-70">
                  {ds.name.length > 5 ? ds.name.slice(0, 5) + '…' : ds.name}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DatastreamEngine({ deviceId, onStreamsChange }) {
  const [streams,     setStreams]     = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(false);

  const load = useCallback(() => {
    if (!deviceId) return;
    setLoading(true);
    api.get('/datastream', { params: { device_id: deviceId } })
      .then(r => { setStreams(r.data); onStreamsChange?.(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [deviceId, onStreamsChange]);

  useEffect(() => { load(); setSelectedPin(null); }, [load]);

  const takenPins = new Set(streams.map(s => s.virtual_pin));
  const selected  = streams.find(s => s.virtual_pin === selectedPin);

  function handleSaved() { load(); }

  async function handleDelete(ds) {
    if (!window.confirm(`Delete V${ds.virtual_pin} · ${ds.display_name}?`)) return;
    await api.delete(`/datastream/${ds.id}`);
    load();
    setSelectedPin(null);
  }

  // Filter table rows
  const filtered = streams.filter(s =>
    !search || s.name.includes(search) || s.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const TYPE_LABEL_STYLE = {
    integer: 'bg-sky-950 text-sky-400 border border-sky-800',
    double:  'bg-emerald-950 text-emerald-400 border border-emerald-800',
    string:  'bg-amber-950 text-amber-400 border border-amber-800',
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-200">{streams.length}<span className="text-base font-normal text-slate-600">/256</span></div>
          <div className="text-xs text-slate-500 mt-0.5">Virtual pins used</div>
          <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-sky-600 rounded-full transition-all" style={{ width: `${(streams.length / 256) * 100}%` }} />
          </div>
        </div>
        {['integer','double','string'].map(t => {
          const count = streams.filter(s => s.data_type === t).length;
          return (
            <div key={t} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center min-w-[80px]">
              <div className={`text-xl font-bold ${TYPE_STYLE[t]?.text}`}>{count}</div>
              <div className="text-xs text-slate-600 capitalize mt-0.5">{t}</div>
            </div>
          );
        })}
      </div>

      {/* Pin grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Virtual Pin Map</span>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            {Object.entries(TYPE_STYLE).map(([t, s]) => (
              <span key={t} className={`px-2 py-0.5 rounded border font-medium ${s.bg} ${s.text}`}>{t}</span>
            ))}
            <span className="px-2 py-0.5 rounded border border-slate-800 text-slate-700 bg-slate-900">empty</span>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-8 text-slate-600 text-sm">Loading…</div>
        ) : (
          <PinGrid streams={streams} onSelect={setSelectedPin} selectedPin={selectedPin} />
        )}
      </div>

      {/* Edit drawer — appears when a pin is selected */}
      {selectedPin !== null && (
        <EditDrawer
          pin={selectedPin}
          existing={selected}
          deviceId={parseInt(deviceId)}
          takenPins={takenPins}
          onClose={() => setSelectedPin(null)}
          onSaved={() => { handleSaved(); setSelectedPin(null); }}
        />
      )}

      {/* ── Datastream Table ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configured Datastreams</span>
          <input
            type="search"
            placeholder="Filter…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-sky-600 w-40"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-600 text-sm">
            {streams.length === 0 ? 'No datastreams yet — click any pin above to create one.' : 'No results.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-950/60">
                {['V-Pin', 'Name', 'Display Name', 'Type', 'Unit', 'Min', 'Max', 'Default', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ds => (
                <tr key={ds.id} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="px-3 py-3">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 border border-sky-900 rounded-md px-2 py-0.5">
                      V{ds.virtual_pin}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-400">{ds.name}</td>
                  <td className="px-3 py-3 text-slate-200 font-medium text-sm">{ds.display_name}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${TYPE_LABEL_STYLE[ds.data_type]}`}>
                      {ds.data_type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{ds.unit || '—'}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 font-mono">{ds.min_value ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 font-mono">{ds.max_value ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 font-mono">{ds.default_value || '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setSelectedPin(ds.virtual_pin)}
                        className="px-2.5 py-1 text-xs border border-slate-700 rounded-md text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(ds)}
                        className="px-2.5 py-1 text-xs border border-rose-900 rounded-md text-rose-500 hover:bg-rose-950 transition-colors">
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
