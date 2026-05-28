const db       = require('../config/db');
const parseMYT = require('../utils/parseMYT');

// Known sensor type → unit mappings (fallback when caller doesn't supply units)
const UNIT_MAP = {
  temperature: '°C',
  humidity:    '%',
  pressure:    'hPa',
  light:       'lux',
  co2:         'ppm',
  motion:      '',
  voltage:     'V',
  current:     'A',
  power:       'W',
  speed:       'm/s',
  distance:    'cm',
  weight:      'kg',
  ph:          'pH',
  soil_moisture: '%',
};

// Unified internal format ingested from any protocol
// units param is a { sensor_type: unit_string } map (optional, sent by simulator)
async function saveSensorData({ device_id, protocol, event_type, data, timestamp, units = {} }) {
  if (!data || typeof data !== 'object') return;

  const ts = timestamp ? new Date(timestamp) : new Date();
  const rows = Object.entries(data).map(([sensor_type, value]) => {
    const unit = units[sensor_type] ?? UNIT_MAP[sensor_type] ?? null;
    return [device_id, sensor_type, parseFloat(value), unit, protocol, ts];
  });

  if (!rows.length) return;

  await db.query(
    'INSERT INTO sensor_data (device_id, sensor_type, value, unit, protocol, timestamp) VALUES ?',
    [rows]
  );
}

async function getLatestByDevice(deviceId, limit = 50) {
  const [rows] = await db.query(
    `SELECT sensor_type, value, unit, protocol, timestamp
     FROM sensor_data
     WHERE device_id = ?
     ORDER BY timestamp DESC
     LIMIT ?`,
    [deviceId, limit]
  );
  return rows;
}

async function getHistoryByDevice({ deviceId, sensorType, startDate, endDate, limit = 1000 }) {
  let sql = `SELECT sensor_type, value, unit, timestamp
             FROM sensor_data WHERE device_id = ?`;
  const params = [deviceId];

  if (sensorType)  { sql += ' AND sensor_type = ?'; params.push(sensorType); }
  if (startDate)   { sql += ' AND timestamp >= ?';  params.push(new Date(startDate)); }
  if (endDate)     { sql += ' AND timestamp <= ?';  params.push(new Date(endDate)); }

  sql += ' ORDER BY timestamp ASC LIMIT ?';
  params.push(parseInt(limit));

  const [rows] = await db.query(sql, params);
  return rows;
}

// Returns distinct sensor types recorded for a device
async function getSensorTypes(deviceId) {
  const [rows] = await db.query(
    'SELECT DISTINCT sensor_type FROM sensor_data WHERE device_id = ? ORDER BY sensor_type ASC',
    [deviceId]
  );
  return rows.map(r => r.sensor_type);
}

// Returns a streaming MySQL query for CSV export (no memory blow-up)
function streamExport(db_raw, { deviceId, sensorType, startDate, endDate }) {
  let sql = 'SELECT timestamp, device_id, sensor_type, value, unit FROM sensor_data WHERE device_id = ?';
  const params = [deviceId];

  if (sensorType) { sql += ' AND sensor_type = ?'; params.push(sensorType); }
  if (startDate)  { sql += ' AND timestamp >= ?';  params.push(new Date(startDate)); }
  if (endDate)    { sql += ' AND timestamp <= ?';  params.push(new Date(endDate)); }

  sql += ' ORDER BY timestamp ASC';
  return db_raw.query(sql, params).stream();
}

// Full export query for client-side XLSX generation.
// JOINs with datastreams to resolve display_name for each virtual pin.
// Returns raw UTC Date objects — caller is responsible for TZ conversion.
// No row limit — intended for user-controlled date-range exports.
async function getExportData({ deviceId, sensorTypes, startDate, endDate }) {
  let sql = `
    SELECT
      sd.timestamp,
      sd.sensor_type,
      COALESCE(ds.display_name, sd.sensor_type) AS display_name,
      sd.value,
      COALESCE(sd.unit, ds.unit, '')            AS unit
    FROM sensor_data sd
    LEFT JOIN datastreams ds
      ON  ds.device_id = sd.device_id
      AND CONCAT('V', ds.virtual_pin) = sd.sensor_type
    WHERE sd.device_id = ?
  `;
  const params = [deviceId];

  if (sensorTypes && sensorTypes.length) {
    sql += ` AND sd.sensor_type IN (${sensorTypes.map(() => '?').join(',')})`;
    params.push(...sensorTypes);
  }

  const start = parseMYT(startDate);
  const end   = parseMYT(endDate);
  if (start) { sql += ' AND sd.timestamp >= ?'; params.push(start); }
  if (end)   { sql += ' AND sd.timestamp <= ?'; params.push(end); }

  sql += ' ORDER BY sd.timestamp ASC';

  const [rows] = await db.query(sql, params);
  return rows;
}

module.exports = { saveSensorData, getLatestByDevice, getHistoryByDevice, getSensorTypes, streamExport, getExportData };
