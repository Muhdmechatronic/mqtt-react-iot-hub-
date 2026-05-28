const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

async function registerDevice({ userId, name, device_type, description }) {
  const api_key = uuidv4().replace(/-/g, '');
  const [result] = await db.query(
    'INSERT INTO devices (user_id, name, device_type, api_key, description) VALUES (?, ?, ?, ?, ?)',
    [userId, name, device_type || 'generic', api_key, description || null]
  );
  return { id: result.insertId, name, device_type, api_key };
}

async function getDevicesByUser(userId) {
  const [rows] = await db.query(
    'SELECT id, name, device_type, api_key, is_online, last_seen, firmware, description, created_at FROM devices WHERE user_id = ?',
    [userId]
  );
  return rows;
}

async function getDeviceByApiKey(apiKey) {
  const [rows] = await db.query('SELECT * FROM devices WHERE api_key = ?', [apiKey]);
  return rows[0] || null;
}

async function getDeviceById(deviceId) {
  const [rows] = await db.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
  return rows[0] || null;
}

async function markOnline(deviceId, online) {
  await db.query(
    'UPDATE devices SET is_online = ?, last_seen = NOW() WHERE id = ?',
    [online ? 1 : 0, deviceId]
  );
}

async function updatePing(deviceId) {
  await db.query(
    'UPDATE devices SET is_online = 1, last_seen = NOW(), last_ping_at = NOW() WHERE id = ?',
    [deviceId]
  );
}

async function sendCommand({ deviceId, issuedBy, command, payload }) {
  const [result] = await db.query(
    'INSERT INTO commands (device_id, issued_by, command, payload) VALUES (?, ?, ?, ?)',
    [deviceId, issuedBy, command, JSON.stringify(payload || {})]
  );
  return result.insertId;
}

module.exports = { registerDevice, getDevicesByUser, getDeviceByApiKey, getDeviceById, markOnline, updatePing, sendCommand };
