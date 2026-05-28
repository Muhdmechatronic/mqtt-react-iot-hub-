import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../services/api';
import { toMYTTime } from '../utils/time';

const MAX_POINTS = 120;

export default function LineChartWidget({ title, deviceId, dataKey, settings, lastEvent }) {
  const color  = settings.color ?? '#38bdf8';
  const unit   = settings.unit  ?? '';

  const [data,   setData]   = useState([]);
  const [paused, setPaused] = useState(false);

  const alive    = useRef(true);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // ── Load history on mount ────────────────────────────────────────────────────
  useEffect(() => {
    alive.current = true;
    if (!deviceId || !dataKey) return;

    api.get('/sensor/history', {
      params: { device_id: deviceId, sensor_type: dataKey, limit: 60 },
    }).then(r => {
      if (!alive.current) return;
      setData(r.data.map(row => ({
        t:     toMYTTime(row.timestamp),
        value: parseFloat(row.value),
      })));
    }).catch(() => {});

    return () => { alive.current = false; };
  }, [deviceId, dataKey]);

  // ── Append live data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastEvent || pausedRef.current) return;
    if (String(lastEvent.device_id) !== String(deviceId)) return;
    const v = lastEvent.data?.[dataKey];
    if (v === undefined || v === null) return;

    const value = parseFloat(v);
    if (isNaN(value)) return;

    const t = toMYTTime(lastEvent.timestamp || new Date().toISOString());
    setData(prev => [...prev, { t, value }].slice(-MAX_POINTS));
  }, [lastEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest  = data.length > 0 ? data[data.length - 1].value : undefined;
  const isEmpty = data.length === 0;

  const clearData = useCallback(() => setData([]), []);

  return (
    <div style={{ padding: '8px 6px 4px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, padding: '0 4px' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Pause / resume */}
          <button
            onClick={() => setPaused(p => !p)}
            title={paused ? 'Resume live updates' : 'Pause live updates'}
            style={{
              background:   paused ? '#334155' : 'none',
              border:       `1px solid ${paused ? '#64748b' : '#1e293b'}`,
              borderRadius: 4,
              color:        paused ? '#f59e0b' : '#475569',
              fontSize:     9,
              padding:      '2px 6px',
              cursor:       'pointer',
              fontWeight:   600,
              letterSpacing: '0.5px',
            }}
          >
            {paused ? '▶ LIVE' : '⏸ PAUSE'}
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color }}>
            {latest !== undefined ? latest.toFixed(2) : '--'}
            {unit && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 2 }}>{unit}</span>}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {isEmpty ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>
            {deviceId && dataKey ? 'Waiting for data…' : 'No sensor configured'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" />
              <XAxis
                dataKey="t"
                tick={{ fill: '#475569', fontSize: 9 }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 9 }}
                width={42}
                tickFormatter={v => v.toFixed(1)}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11, borderRadius: 6 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={v => [
                  `${parseFloat(v).toFixed(2)}${unit ? ' ' + unit : ''}`,
                  dataKey,
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4, fill: color }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#1e3a5f', paddingRight: 8, paddingTop: 2 }}>
        <button
          onClick={clearData}
          style={{ background: 'none', border: 'none', color: '#334155', fontSize: 9, cursor: 'pointer', padding: 0 }}
        >
          clear
        </button>
        <span>{data.length}/{MAX_POINTS} pts · MYT {paused ? '· PAUSED' : ''}</span>
      </div>
    </div>
  );
}
