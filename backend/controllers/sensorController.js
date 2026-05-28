const { stringify } = require('csv-stringify');
const db            = require('../config/db');
const sensorService = require('../services/sensorService');
const parseMYT      = require('../utils/parseMYT');

async function getLatest(req, res) {
  const { device_id } = req.query;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });
  const rows = await sensorService.getLatestByDevice(parseInt(device_id));
  res.json(rows);
}

async function getHistory(req, res) {
  const { device_id, sensor_type, start_date, end_date, limit } = req.query;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });
  const rows = await sensorService.getHistoryByDevice({
    deviceId:   parseInt(device_id),
    sensorType: sensor_type,
    startDate:  start_date,
    endDate:    end_date,
    limit:      parseInt(limit || 1000),
  });
  res.json(rows);
}

// Returns distinct sensor types recorded for a device
async function getSensorTypes(req, res) {
  const { device_id } = req.query;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });
  const types = await sensorService.getSensorTypes(parseInt(device_id));
  res.json(types);
}

// Streaming CSV export — never loads all rows into memory
// Timestamps are converted from UTC → Malaysia Time (MYT, UTC+8)
async function exportCsv(req, res) {
  const { device_id, sensor_type, start_date, end_date } = req.query;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });

  res.setHeader('Content-Type', 'text/csv');
  const fname = sensor_type
    ? `sensor_${sensor_type}_device${device_id}.csv`
    : `sensor_all_device${device_id}.csv`;
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);

  const [sql, params] = buildExportSql({
    device_id:  parseInt(device_id),
    sensor_type: sensor_type || null,
    start_date,
    end_date,
  });

  const stringifier = stringify({
    header:  true,
    columns: ['timestamp', 'device_id', 'sensor_type', 'value', 'unit'],
  });

  const conn  = await db.getConnection();
  const query = conn.connection.query(sql, params);

  query.on('error', (err) => { conn.release(); res.end(); console.error('[CSV] Stream error:', err); });
  query.on('end',   ()    => { conn.release(); });
  query.stream().pipe(stringifier).pipe(res);
}

// Returns [sql, params].  Uses parameterised values — no string interpolation.
// Timestamps in the result are formatted as "YYYY-MM-DD HH:MM:SS (MYT)".
function buildExportSql({ device_id, sensor_type, start_date, end_date }) {
  const sql_parts = [
    `SELECT
       CONCAT(DATE_FORMAT(timestamp + INTERVAL 8 HOUR, '%Y-%m-%d %H:%i:%S'), ' (MYT)') AS timestamp,
       device_id,
       sensor_type,
       value,
       unit
     FROM sensor_data
     WHERE device_id = ?`,
  ];
  const params = [device_id];

  if (sensor_type) { sql_parts.push('AND sensor_type = ?'); params.push(sensor_type); }

  const start = parseMYT(start_date);
  const end   = parseMYT(end_date);
  if (start) { sql_parts.push('AND timestamp >= ?'); params.push(start); }
  if (end)   { sql_parts.push('AND timestamp <= ?'); params.push(end); }

  sql_parts.push('ORDER BY timestamp ASC');
  return [sql_parts.join(' '), params];
}

// JSON export for client-side XLSX generation.
// Returns raw UTC timestamps — the frontend converts them to MYT.
// Accepts multiple sensor types via comma-separated 'sensor_types' query param.
async function exportJson(req, res) {
  const { device_id, sensor_types, start_date, end_date } = req.query;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });

  // Validate each token — only "V{0-255}" tokens are accepted to prevent injection.
  let types = null;
  if (sensor_types && sensor_types.trim()) {
    types = sensor_types
      .split(',')
      .map(t => t.trim())
      .filter(t => /^V\d{1,3}$/.test(t));
    if (!types.length) return res.json([]);
  }

  try {
    const rows = await sensorService.getExportData({
      deviceId:    parseInt(device_id),
      sensorTypes: types,
      startDate:   start_date,
      endDate:     end_date,
    });
    res.json(rows);
  } catch (err) {
    console.error('[exportJson]', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getLatest, getHistory, getSensorTypes, exportCsv, exportJson };
