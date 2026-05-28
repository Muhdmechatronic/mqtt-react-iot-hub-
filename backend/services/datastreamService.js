const db = require('../config/db');

async function getByDevice(deviceId, userId) {
  const [rows] = await db.query(
    `SELECT * FROM datastreams
     WHERE device_id = ? AND user_id = ?
     ORDER BY virtual_pin ASC`,
    [deviceId, userId]
  );
  return rows;
}

async function getById(id, userId) {
  const [[row]] = await db.query(
    'SELECT * FROM datastreams WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return row || null;
}

async function create({ userId, deviceId, virtualPin, name, displayName, dataType, accessType, unit, minValue, maxValue, defaultValue }) {
  const [result] = await db.query(
    `INSERT INTO datastreams
       (user_id, device_id, virtual_pin, name, display_name, data_type, access_type, unit, min_value, max_value, default_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, deviceId, virtualPin, name, displayName, dataType,
     accessType || 'READ_WRITE',
     unit || null,
     (dataType !== 'string' && minValue !== '' && minValue !== null) ? parseFloat(minValue) : null,
     (dataType !== 'string' && maxValue !== '' && maxValue !== null) ? parseFloat(maxValue) : null,
     defaultValue || null]
  );
  return result.insertId;
}

async function update(id, userId, { virtualPin, name, displayName, dataType, accessType, unit, minValue, maxValue, defaultValue }) {
  await db.query(
    `UPDATE datastreams
     SET virtual_pin=?, name=?, display_name=?, data_type=?, access_type=?, unit=?,
         min_value=?, max_value=?, default_value=?
     WHERE id = ? AND user_id = ?`,
    [virtualPin, name, displayName, dataType,
     accessType || 'READ_WRITE',
     unit || null,
     (dataType !== 'string' && minValue !== '' && minValue !== null) ? parseFloat(minValue) : null,
     (dataType !== 'string' && maxValue !== '' && maxValue !== null) ? parseFloat(maxValue) : null,
     defaultValue || null,
     id, userId]
  );
}

async function remove(id, userId) {
  await db.query('DELETE FROM datastreams WHERE id = ? AND user_id = ?', [id, userId]);
}

async function isPinTaken(deviceId, virtualPin, excludeId = null) {
  const [rows] = await db.query(
    `SELECT id FROM datastreams WHERE device_id = ? AND virtual_pin = ?${excludeId ? ' AND id != ?' : ''}`,
    excludeId ? [deviceId, virtualPin, excludeId] : [deviceId, virtualPin]
  );
  return rows.length > 0;
}

module.exports = { getByDevice, getById, create, update, remove, isPinTaken };
