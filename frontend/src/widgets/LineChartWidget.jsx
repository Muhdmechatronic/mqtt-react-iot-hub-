import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Label,
} from 'recharts';
import api from '../services/api';
import { toMYTTime } from '../utils/time';

// Limit per window — backend already filters by time, this is a safety cap
const WINDOW_LIMIT = 5000;

const WINDOWS = [
  { key: '1h', label: '1h', ms: 1  * 60 * 60 * 1000 },
  { key: '5h', label: '5h', ms: 5  * 60 * 60 * 1000 },
  { key: '1d', label: '1d', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7d', ms: 7  * 24 * 60 * 60 * 1000 },
];

export default function LineChartWidget({ title, deviceId, dataKey, settings, lastEvent }) {
  const color      = settings.color      ?? '#38bdf8';
  const unit       = settings.unit       ?? '';
  const chartType  = settings.chartType  ?? 'area';
  const xAxisTitle = settings.xAxisTitle ?? '';
  const yAxisTitle = settings.yAxisTitle ?? '';

  // Use timeWin to avoid shadowing the browser global `window`
  const [timeWin, setTimeWin] = useState(settings.timeWindow ?? '1h');
  const [data,    setData]    = useState([]);
  const [paused,  setPaused]  = useState(false);
  const [loading, setLoading] = useState(false);

  const alive     = useRef(true);
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // ── Fetch history for the current time window ───────────────────────────────
  // Always compute start/end at call-time so we get the LATEST slice of data.
  // We request a high limit so ORDER BY ASC LIMIT doesn't cut off recent points.
  const loadHistory = useCallback(async (win) => {
    if (!deviceId || !dataKey) return;
    const winObj = WINDOWS.find(w => w.key === win) ?? WINDOWS[0];
    const now    = new Date();
    const from   = new Date(now.getTime() - winObj.ms).toISOString();
    const to     = now.toISOString();

    setLoading(true);
    setData([]);     // clear immediately so stale data never shows
    try {
      const r = await api.get('/sensor/history', {
        params: {
          device_id:   deviceId,
          sensor_type: dataKey,
          start_date:  from,
          end_date:    to,
          limit:       WINDOW_LIMIT,
        },
      });
      if (!alive.current) return;
      setData(r.data.map(row => ({
        t:     toMYTTime(row.timestamp),
        value: parseFloat(row.value),
      })));
    } catch {}
    setLoading(false);
  }, [deviceId, dataKey]);

  // Re-fetch whenever device/key changes or timeWin changes
  useEffect(() => {
    alive.current = true;
    loadHistory(timeWin);
    return () => { alive.current = false; };
  }, [loadHistory, timeWin]);

  // ── Append live WebSocket data ──────────────────────────────────────────────
  useEffect(() => {
    if (!lastEvent || pausedRef.current) return;
    if (String(lastEvent.device_id) !== String(deviceId)) return;
    const v = lastEvent.data?.[dataKey];
    if (v === undefined || v === null) return;
    const value = parseFloat(v);
    if (isNaN(value)) return;
    const t = toMYTTime(lastEvent.timestamp || new Date().toISOString());
    setData(prev => [...prev, { t, value }].slice(-WINDOW_LIMIT));
  }, [lastEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest    = data.length > 0 ? data[data.length - 1].value : undefined;
  const isEmpty   = data.length === 0;
  const clearData = useCallback(() => setData([]), []);

  // ── Recharts shared elements ────────────────────────────────────────────────
  const margin = { top: 4, right: 8, bottom: xAxisTitle ? 20 : 4, left: yAxisTitle ? 8 : -8 };

  const xAxis = (
    <XAxis dataKey="t" tick={{ fill: 'var(--w-text-muted)', fontSize: 9 }} interval="preserveStartEnd" minTickGap={40}>
      {xAxisTitle && <Label value={xAxisTitle} offset={-12} position="insideBottom" style={{ fill: 'var(--w-text-muted)', fontSize: 10 }} />}
    </XAxis>
  );
  const yAxis = (
    <YAxis tick={{ fill: 'var(--w-text-muted)', fontSize: 9 }} width={yAxisTitle ? 50 : 42} tickFormatter={v => v.toFixed(1)}>
      {yAxisTitle && <Label value={yAxisTitle} angle={-90} position="insideLeft" offset={12} style={{ fill: 'var(--w-text-muted)', fontSize: 10 }} />}
    </YAxis>
  );
  const tooltip = (
    <Tooltip
      contentStyle={{ background: 'var(--w-tooltip-bg)', border: 'var(--w-tooltip-bdr)', fontSize: 11, borderRadius: 6 }}
      labelStyle={{ color: 'var(--w-text-dim)' }}
      formatter={v => [`${parseFloat(v).toFixed(2)}${unit ? ' ' + unit : ''}`, dataKey]}
    />
  );
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--w-grid)" />;

  function renderChart() {
    if (chartType === 'bar') {
      return (
        <BarChart data={data} margin={margin}>
          {grid}{xAxis}{yAxis}{tooltip}
          <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      );
    }
    if (chartType === 'area') {
      return (
        <AreaChart data={data} margin={margin}>
          <defs>
            <linearGradient id={`cg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {grid}{xAxis}{yAxis}{tooltip}
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
            fill={`url(#cg-${color.replace('#', '')})`}
            dot={false} isAnimationActive={false} activeDot={{ r: 4, fill: color }} />
        </AreaChart>
      );
    }
    return (
      <LineChart data={data} margin={margin}>
        {grid}{xAxis}{yAxis}{tooltip}
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2}
          dot={false} isAnimationActive={false} activeDot={{ r: 4, fill: color }} />
      </LineChart>
    );
  }

  return (
    <div style={{ padding: '6px 6px 4px', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--w-bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, padding: '0 2px', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--w-text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>

        {/* Time window selector */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {WINDOWS.map(w => (
            <button key={w.key} onClick={() => setTimeWin(w.key)}
              style={{
                padding: '1px 5px', fontSize: 9, borderRadius: 4, cursor: 'pointer', fontWeight: 600,
                border: `1px solid ${timeWin === w.key ? color : 'var(--w-border)'}`,
                background: timeWin === w.key ? color + '22' : 'transparent',
                color: timeWin === w.key ? color : 'var(--w-text-muted)',
                transition: 'all 0.12s',
              }}
            >{w.label}</button>
          ))}
        </div>

        {/* Pause button */}
        <button onClick={() => setPaused(p => !p)}
          style={{
            background: paused ? 'var(--w-track)' : 'none',
            border: '1px solid var(--w-border)', borderRadius: 4,
            color: paused ? '#f59e0b' : 'var(--w-text-muted)',
            fontSize: 9, padding: '1px 5px', cursor: 'pointer', fontWeight: 600, flexShrink: 0,
          }}
        >{paused ? '▶' : '⏸'}</button>

        {/* Live value */}
        <span style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0 }}>
          {latest !== undefined ? latest.toFixed(2) : '--'}
          {unit && <span style={{ fontSize: 9, color: 'var(--w-text-muted)', marginLeft: 2 }}>{unit}</span>}
        </span>
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--w-text-muted)', fontSize: 11 }}>
            Loading…
          </div>
        ) : isEmpty ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--w-text-dim)', fontSize: 11 }}>
            {deviceId && dataKey ? `No data in last ${timeWin}` : 'No sensor configured'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--w-text-dim)', paddingTop: 2, flexShrink: 0 }}>
        <button onClick={clearData} style={{ background: 'none', border: 'none', color: 'var(--w-text-dim)', fontSize: 9, cursor: 'pointer', padding: 0 }}>
          clear
        </button>
        <span>{data.length} pts {paused ? '· PAUSED' : '· live'}</span>
      </div>
    </div>
  );
}
