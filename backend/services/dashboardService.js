const db = require('../config/db');

async function getDashboardsByUser(userId) {
  const [rows] = await db.query(
    'SELECT * FROM dashboards WHERE user_id = ? ORDER BY is_default DESC, created_at ASC',
    [userId]
  );
  return rows;
}

async function createDashboard({ userId, name, description }) {
  const [result] = await db.query(
    'INSERT INTO dashboards (user_id, name, description) VALUES (?, ?, ?)',
    [userId, name, description || null]
  );
  return { id: result.insertId, name };
}

async function getWidgets(dashboardId, userId) {
  const [rows] = await db.query(
    'SELECT * FROM widgets WHERE dashboard_id = ? AND user_id = ? ORDER BY position_y ASC, position_x ASC',
    [dashboardId, userId]
  );
  return rows.map(w => ({
    ...w,
    settings_json: w.settings_json || {}
  }));
}

async function createWidget({ userId, dashboardId, type, title, deviceId, datastreamId, dataKey, mqttTopic, x, y, w, h, settings }) {
  const [result] = await db.query(
    `INSERT INTO widgets
      (user_id, dashboard_id, type, title, device_id, datastream_id, data_key, mqtt_topic,
       position_x, position_y, width, height, settings_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, dashboardId, type, title, deviceId || null, datastreamId || null,
     dataKey || null, mqttTopic || null,
     x || 0, y || 0, w || 2, h || 2, JSON.stringify(settings || {})]
  );
  return result.insertId;
}

async function updateWidgetLayout(widgetId, userId, { x, y, w, h }) {
  await db.query(
    'UPDATE widgets SET position_x=?, position_y=?, width=?, height=? WHERE id=? AND user_id=?',
    [x, y, w, h, widgetId, userId]
  );
}

async function updateWidget(widgetId, userId, { type, title, device_id, data_key, settings }) {
  await db.query(
    `UPDATE widgets
     SET type=?, title=?, device_id=?, data_key=?, settings_json=?
     WHERE id=? AND user_id=?`,
    [type, title, device_id || null, data_key || null, JSON.stringify(settings || {}), widgetId, userId]
  );
}

async function deleteWidget(widgetId, userId) {
  await db.query('DELETE FROM widgets WHERE id=? AND user_id=?', [widgetId, userId]);
}

async function findDashboardByName(userId, name) {
  const [rows] = await db.query(
    'SELECT id FROM dashboards WHERE user_id = ? AND name = ? LIMIT 1',
    [userId, name.trim()]
  );
  return rows[0] || null;
}

async function clearDashboardWidgets(dashboardId, userId) {
  await db.query('DELETE FROM widgets WHERE dashboard_id = ? AND user_id = ?', [dashboardId, userId]);
}

async function deleteDashboard(dashboardId, userId) {
  await db.query('DELETE FROM widgets WHERE dashboard_id = ? AND user_id = ?', [dashboardId, userId]);
  await db.query('DELETE FROM dashboards WHERE id = ? AND user_id = ?', [dashboardId, userId]);
}

module.exports = {
  getDashboardsByUser, createDashboard, getWidgets, createWidget,
  updateWidgetLayout, updateWidget, deleteWidget,
  findDashboardByName, clearDashboardWidgets, deleteDashboard,
};
