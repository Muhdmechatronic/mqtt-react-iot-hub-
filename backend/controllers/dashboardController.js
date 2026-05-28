const dashboardService = require('../services/dashboardService');

async function listDashboards(req, res) {
  const dashboards = await dashboardService.getDashboardsByUser(req.user.id);
  res.json(dashboards);
}

async function createDashboard(req, res) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  // Upsert: same name for this user → clear its widgets and reuse
  const existing = await dashboardService.findDashboardByName(req.user.id, name);
  if (existing) {
    await dashboardService.clearDashboardWidgets(existing.id, req.user.id);
    return res.json({ id: existing.id, name: name.trim(), overwritten: true });
  }

  const dashboard = await dashboardService.createDashboard({ userId: req.user.id, name, description });
  res.status(201).json(dashboard);
}

async function getWidgets(req, res) {
  const { dashboard_id } = req.params;
  const widgets = await dashboardService.getWidgets(parseInt(dashboard_id), req.user.id);
  res.json(widgets);
}

async function createWidget(req, res) {
  const { dashboard_id } = req.params;
  const { type, title, device_id, datastream_id, data_key, mqtt_topic, x, y, w, h, settings } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'type and title required' });

  const id = await dashboardService.createWidget({
    userId:       req.user.id,
    dashboardId:  parseInt(dashboard_id),
    type, title,
    deviceId:     device_id,
    datastreamId: datastream_id,
    dataKey:      data_key,
    mqttTopic:    mqtt_topic,
    x, y, w, h, settings,
  });
  res.status(201).json({ id });
}

async function updateLayout(req, res) {
  const { widget_id } = req.params;
  const { x, y, w, h } = req.body;
  await dashboardService.updateWidgetLayout(parseInt(widget_id), req.user.id, { x, y, w, h });
  res.json({ message: 'Layout updated' });
}

async function updateWidget(req, res) {
  const { widget_id } = req.params;
  const { type, title, device_id, data_key, settings } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'type and title required' });
  await dashboardService.updateWidget(parseInt(widget_id), req.user.id, {
    type, title, device_id, data_key, settings,
  });
  res.json({ message: 'Widget updated' });
}

async function removeWidget(req, res) {
  const { widget_id } = req.params;
  await dashboardService.deleteWidget(parseInt(widget_id), req.user.id);
  res.json({ message: 'Widget deleted' });
}

async function deleteDashboard(req, res) {
  const { dashboard_id } = req.params;
  await dashboardService.deleteDashboard(parseInt(dashboard_id), req.user.id);
  res.json({ message: 'deleted' });
}

module.exports = { listDashboards, createDashboard, getWidgets, createWidget, updateLayout, updateWidget, removeWidget, deleteDashboard };
