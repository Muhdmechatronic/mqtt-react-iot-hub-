import React, { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:       { color: '#e2e8f0', maxWidth: 740 },
  title:      { fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 },
  subtitle:   { fontSize: 13, color: '#64748b', marginBottom: 28 },
  card:       { background: '#1e293b', borderRadius: 12, padding: 24, marginBottom: 20, border: '1px solid #1e3a5f' },
  stepLabel:  { fontSize: 11, fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 },
  fieldLabel: { display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 5 },
  select:     { width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  input:      { width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  grid2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  hint:       { fontSize: 11, color: '#475569', marginTop: 6 },

  // Pin multi-select
  pinGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6, marginTop: 10 },
  pinRow:     { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, background: '#0f172a', border: '1px solid #1e293b', cursor: 'pointer', userSelect: 'none' },
  pinRowOn:   { borderColor: '#0ea5e9', background: '#0c1a2e' },
  checkbox:   { width: 15, height: 15, accentColor: '#0ea5e9', cursor: 'pointer', flexShrink: 0 },
  pinBadge:   { fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#38bdf8', background: '#0c1a2e', border: '1px solid #1e3a5f', borderRadius: 4, padding: '2px 6px', flexShrink: 0 },
  pinName:    { fontSize: 12, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pinUnit:    { fontSize: 11, color: '#475569', marginLeft: 'auto', flexShrink: 0 },

  // Footer
  footer:     { display: 'flex', alignItems: 'center', gap: 16 },
  btnExport:  { display: 'flex', alignItems: 'center', gap: 8, background: '#0ea5e9', border: 'none', borderRadius: 8, color: '#fff', padding: '11px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  btnDis:     { opacity: 0.5, cursor: 'not-allowed' },
  rowCount:   { fontSize: 13, color: '#64748b' },
  errTxt:     { fontSize: 13, color: '#f87171' },

  // Select-all row
  selAllRow:  { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 10px', borderBottom: '1px solid #1e293b', marginBottom: 10 },
  selAllLbl:  { fontSize: 12, fontWeight: 600, color: '#94a3b8', cursor: 'pointer' },
  dsCount:    { fontSize: 11, color: '#475569', marginLeft: 'auto' },

  empty:      { fontSize: 13, color: '#475569', padding: '20px 0' },
  spinner:    { fontSize: 12, color: '#38bdf8' },
};

// ── Timezone conversion ───────────────────────────────────────────────────────
// All timestamps stored in DB are UTC. Offset MYT = UTC+8.
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

function utcToMYT(rawTimestamp) {
  // MySQL driver returns Date objects or ISO strings; handle both.
  const utc = new Date(rawTimestamp);
  const myt = new Date(utc.getTime() + MYT_OFFSET_MS);
  // Produces "2024-06-15 09:30:00" — no TZ suffix, clearly labelled in header
  return myt.toISOString().slice(0, 19).replace('T', ' ');
}

// ── Data transformation ───────────────────────────────────────────────────────
// Converts raw UTC rows from /api/sensor/export-json into the shape used by
// generateXlsx. Timestamp conversion is the only mutation — all values are
// passed through unchanged so the export faithfully reflects stored data.
function transformRows(rawRows) {
  return rawRows.map(r => ({
    timestamp: utcToMYT(r.timestamp),
    pin:       r.sensor_type,
    name:      r.display_name || r.sensor_type,
    value:     parseFloat(r.value),
    unit:      r.unit || '',
  }));
  // Rows arrive from backend already sorted ASC by timestamp — no re-sort needed.
}

// ── XLSX generation ───────────────────────────────────────────────────────────
const COL_DEFS = [
  { header: 'Timestamp (Malaysia Time)', key: 'timestamp', width: 26 },
  { header: 'Virtual Pin',              key: 'pin',       width: 14 },
  { header: 'Datastream Name',          key: 'name',      width: 24 },
  { header: 'Value',                    key: 'value',     width: 14 },
  { header: 'Unit',                     key: 'unit',      width: 10 },
];

// Header cell style — dark navy fill, bold white text, sky-blue bottom border.
const HEADER_STYLE = {
  font:      { bold: true, sz: 11, color: { rgb: 'F1F5F9' } },
  fill:      { patternType: 'solid', fgColor: { rgb: '0F172A' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top:    { style: 'thin',   color: { rgb: '1E3A5F' } },
    left:   { style: 'thin',   color: { rgb: '1E3A5F' } },
    right:  { style: 'thin',   color: { rgb: '1E3A5F' } },
    bottom: { style: 'medium', color: { rgb: '0EA5E9' } },
  },
};

// Alternating data row styles for readability.
function dataStyle(rowIndex) {
  return {
    fill: {
      patternType: 'solid',
      fgColor: { rgb: rowIndex % 2 === 0 ? '1E293B' : '0F172A' },
    },
    border: {
      top:    { style: 'hair', color: { rgb: '1E3A5F' } },
      left:   { style: 'hair', color: { rgb: '1E3A5F' } },
      right:  { style: 'hair', color: { rgb: '1E3A5F' } },
      bottom: { style: 'hair', color: { rgb: '1E3A5F' } },
    },
    alignment: { vertical: 'center' },
  };
}

function generateXlsx(rows, deviceId) {
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: `IoT Device ${deviceId} Export`, CreatedDate: new Date() };

  // Build sheet from array-of-arrays
  const aoa = [
    COL_DEFS.map(c => c.header),
    ...rows.map(r => COL_DEFS.map(c => r[c.key])),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = COL_DEFS.map(c => ({ wch: c.width }));

  // Freeze the header row so it stays visible while scrolling
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Apply styles cell-by-cell.
  // Note: cell styles (.s property) are honored when writing .xlsx format.
  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let C = range.s.c; C <= range.e.c; C++) {
    // Header row (row 0)
    const hAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[hAddr]) ws[hAddr].s = HEADER_STYLE;

    // Data rows
    for (let R = 1; R <= range.e.r; R++) {
      const dAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[dAddr]) ws[dAddr] = { t: 'z', v: '' };
      ws[dAddr].s = dataStyle(R);

      // Ensure numeric Value column is typed as number for Excel formulas
      if (COL_DEFS[C].key === 'value' && ws[dAddr].t !== 'z') {
        ws[dAddr].t = 'n';
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Sensor Data');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `device_data_export_${deviceId}_${dateStr}.xlsx`);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExportPage() {
  const [devices,     setDevices]     = useState([]);
  const [deviceId,    setDeviceId]    = useState('');
  const [datastreams, setDatastreams] = useState([]);
  const [loadingDs,   setLoadingDs]   = useState(false);
  const [selectedPins, setSelectedPins] = useState(new Set());
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [rowCount,    setRowCount]    = useState(null);
  const [exportErr,   setExportErr]   = useState('');

  // Load device list on mount
  useEffect(() => {
    api.get('/device/list').then(r => setDevices(r.data)).catch(() => {});
  }, []);

  // Load datastreams whenever the device changes and default-select all pins
  const loadDatastreams = useCallback(async (id) => {
    if (!id) { setDatastreams([]); setSelectedPins(new Set()); return; }
    setLoadingDs(true);
    setDatastreams([]);
    setSelectedPins(new Set());
    setRowCount(null);
    setExportErr('');
    try {
      const { data } = await api.get('/datastream', { params: { device_id: id } });
      setDatastreams(data);
      // Select all pins by default as per the feature spec
      setSelectedPins(new Set(data.map(ds => `V${ds.virtual_pin}`)));
    } catch {
      setDatastreams([]);
    } finally {
      setLoadingDs(false);
    }
  }, []);

  function onDeviceChange(e) {
    const id = e.target.value;
    setDeviceId(id);
    loadDatastreams(id);
  }

  // Toggle a single pin checkbox
  function togglePin(pin) {
    setSelectedPins(prev => {
      const next = new Set(prev);
      if (next.has(pin)) next.delete(pin); else next.add(pin);
      return next;
    });
  }

  // Select All / Deselect All
  function toggleAll() {
    if (selectedPins.size === datastreams.length) {
      setSelectedPins(new Set());
    } else {
      setSelectedPins(new Set(datastreams.map(ds => `V${ds.virtual_pin}`)));
    }
  }

  const allSelected  = datastreams.length > 0 && selectedPins.size === datastreams.length;
  const someSelected = selectedPins.size > 0 && selectedPins.size < datastreams.length;

  // ── Export handler ──────────────────────────────────────────────────────────
  async function handleExport() {
    if (!deviceId || selectedPins.size === 0) return;
    setLoading(true);
    setRowCount(null);
    setExportErr('');

    try {
      // Build query params
      const params = { device_id: deviceId };

      // Only send sensor_types when it's a subset — omitting it means "all"
      if (selectedPins.size < datastreams.length) {
        params.sensor_types = [...selectedPins].sort().join(',');
      }
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date   = endDate;

      const { data: rawRows } = await api.get('/sensor/export-json', { params });
      setRowCount(rawRows.length);

      if (!rawRows.length) {
        setExportErr('No data found for the selected filters. Try widening the date range.');
        return;
      }

      // Convert UTC → MYT and structure for XLSX
      const rows = transformRows(rawRows);
      generateXlsx(rows, deviceId);
    } catch (err) {
      setExportErr(err.response?.data?.error || err.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  const canExport = Boolean(deviceId) && selectedPins.size > 0 && !loading;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.title}>Export Sensor Data</div>
      <div style={s.subtitle}>
        Download historical virtual-pin records as an Excel spreadsheet.
        Timestamps are converted to Malaysia Time (MYT, UTC+8) in the output file.
      </div>

      {/* ── Step 1: Device ── */}
      <div style={s.card}>
        <div style={s.stepLabel}>Step 1 — Select Device</div>
        <label style={s.fieldLabel}>Device</label>
        <select style={s.select} value={deviceId} onChange={onDeviceChange}>
          <option value="">-- choose a device --</option>
          {devices.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* ── Step 2: Pin selection ── */}
      <div style={s.card}>
        <div style={s.stepLabel}>Step 2 — Select Virtual Pins</div>

        {!deviceId && (
          <div style={s.empty}>Select a device above to see its datastreams.</div>
        )}

        {deviceId && loadingDs && (
          <div style={s.spinner}>Loading datastreams…</div>
        )}

        {deviceId && !loadingDs && datastreams.length === 0 && (
          <div style={s.empty}>
            No datastreams found for this device. Create them on the Datastreams page first.
          </div>
        )}

        {deviceId && !loadingDs && datastreams.length > 0 && (
          <>
            {/* Select All row */}
            <div style={s.selAllRow}>
              <input
                type="checkbox"
                id="chk-all"
                style={s.checkbox}
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
              />
              <label htmlFor="chk-all" style={s.selAllLbl}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </label>
              <span style={s.dsCount}>
                {selectedPins.size} / {datastreams.length} selected
              </span>
            </div>

            {/* Individual pin checkboxes */}
            <div style={s.pinGrid}>
              {datastreams.map(ds => {
                const pinKey = `V${ds.virtual_pin}`;
                const checked = selectedPins.has(pinKey);
                return (
                  <label
                    key={ds.id}
                    style={{ ...s.pinRow, ...(checked ? s.pinRowOn : {}) }}
                    onClick={() => togglePin(pinKey)}
                  >
                    <input
                      type="checkbox"
                      style={s.checkbox}
                      checked={checked}
                      onChange={() => togglePin(pinKey)}
                      onClick={e => e.stopPropagation()}
                    />
                    <span style={s.pinBadge}>{pinKey}</span>
                    <span style={s.pinName} title={ds.display_name}>{ds.display_name}</span>
                    {ds.unit && <span style={s.pinUnit}>{ds.unit}</span>}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Step 3: Date range ── */}
      <div style={s.card}>
        <div style={s.stepLabel}>Step 3 — Date & Time Range (optional)</div>
        <div style={s.grid2}>
          <div>
            <label style={s.fieldLabel}>Start Date / Time (MYT)</label>
            <input
              type="datetime-local"
              style={s.input}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label style={s.fieldLabel}>End Date / Time (MYT)</label>
            <input
              type="datetime-local"
              style={s.input}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div style={s.hint}>
          Leave both fields blank to export all available history for the selected pins.
          Dates are interpreted as Malaysia Time (UTC+8).
        </div>
      </div>

      {/* ── Export action ── */}
      <div style={s.footer}>
        <button
          style={{ ...s.btnExport, ...(canExport ? {} : s.btnDis) }}
          onClick={handleExport}
          disabled={!canExport}
        >
          {loading ? (
            <>⏳ Fetching data…</>
          ) : (
            <>⬇ Export to Excel (.xlsx)</>
          )}
        </button>

        {!loading && rowCount !== null && !exportErr && (
          <span style={s.rowCount}>
            ✓ {rowCount.toLocaleString()} row{rowCount !== 1 ? 's' : ''} exported
          </span>
        )}

        {exportErr && (
          <span style={s.errTxt}>{exportErr}</span>
        )}
      </div>
    </div>
  );
}
