const deviceService = require('../services/deviceService');
const sensorService = require('../services/sensorService');
const db            = require('../config/db');

async function register(req, res) {
  const { name, device_type, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const device = await deviceService.registerDevice({ userId: req.user.id, name, device_type, description });
    res.status(201).json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function list(req, res) {
  const devices = await deviceService.getDevicesByUser(req.user.id);
  res.json(devices);
}

// HTTP data push (fallback when MQTT unavailable)
async function pushData(req, res) {
  try {
    const apiKey = req.headers['x-api-key'] || req.body.api_key;
    if (!apiKey) return res.status(401).json({ error: 'x-api-key header required' });

    const device = await deviceService.getDeviceByApiKey(apiKey);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const { data, units, timestamp } = req.body;
    if (!data) return res.status(400).json({ error: 'data object required' });

    const unified = {
      device_id:  device.id,
      protocol:   'http',
      event_type: 'sensor',
      data,
      units:      units || {},
      timestamp:  timestamp || new Date().toISOString(),
    };

    await sensorService.saveSensorData(unified);
    // updatePing sets both last_seen and last_ping_at so the heartbeat worker
    // can detect this device going silent even when it only uses HTTP POST.
    await deviceService.updatePing(device.id);

    // Emit realtime update to every browser tab subscribed to this device.
    req.io.to(`device:${device.id}`).emit('sensor_update', unified);

    res.json({ message: 'Data received', device_id: device.id });
  } catch (err) {
    console.error('[pushData] error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function sendCommand(req, res) {
  const { device_id, command, payload, data_key } = req.body;
  if (!device_id || !command) return res.status(400).json({ error: 'device_id and command required' });

  const cmdId = await deviceService.sendCommand({
    deviceId:  device_id,
    issuedBy:  req.user.id,
    command,
    payload,
  });

  // Relay command to hardware via Socket.IO device room
  req.io.to(`device:${device_id}`).emit('command', { command, payload, data_key });

  // Mirror the new value back as a sensor_update so every subscribed dashboard
  // widget (LED, Gauge, Slider) instantly reflects the state change without
  // waiting for a hardware round-trip acknowledgement.
  if (data_key && payload?.value !== undefined) {
    const ts = new Date().toISOString();
    req.io.to(`device:${device_id}`).emit('sensor_update', {
      device_id,
      protocol:   'command',
      event_type: 'command',
      data:       { [data_key]: payload.value },
      timestamp:  ts,
    });
    // Persist the command value to sensor_data so ESP32 polling /api/device/state
    // sees the latest server-set value for this virtual pin.
    sensorService.saveSensorData({
      device_id,
      protocol:   'command',
      event_type: 'command',
      data:       { [data_key]: payload.value },
      units:      {},
      timestamp:  ts,
    }).catch(() => {});
  }

  res.json({ message: 'Command sent', command_id: cmdId });
}

// Lightweight ping from device firmware (no auth — uses api_key)
async function ping(req, res) {
  const apiKey = req.headers['x-api-key'] || req.body?.api_key;
  if (!apiKey) return res.status(401).json({ error: 'x-api-key required' });

  const device = await deviceService.getDeviceByApiKey(apiKey);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const wasOffline = !device.is_online;
  await deviceService.updatePing(device.id);

  if (wasOffline) {
    req.io.to(`user:${device.user_id}`).emit('device_status', {
      device_id: device.id,
      is_online: true,
    });
  }

  res.json({ ok: true });
}

// Return the latest known value for each requested virtual pin.
// Used by ESP32 firmware to poll server-set pin states (dashboard Slider/Switch).
// Endpoint: GET /api/device/state?pins=V2,V3
// Auth: x-api-key header (no JWT required — same as /data and /ping)
async function getDeviceState(req, res) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey) return res.status(401).json({ error: 'x-api-key required' });

  const device = await deviceService.getDeviceByApiKey(apiKey);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const pinsParam = (req.query.pins || '').trim();
  if (!pinsParam) return res.json({});

  // Accept only valid "V{n}" tokens to prevent SQL injection via sensor_type
  const pins = pinsParam
    .split(',')
    .map(p => p.trim())
    .filter(p => /^V\d{1,3}$/.test(p));

  if (!pins.length) return res.json({});

  const result = {};
  // One query per pin — simple and correct (at most 16 pins per poll in practice)
  for (const pin of pins) {
    const [rows] = await db.query(
      `SELECT value FROM sensor_data
       WHERE device_id = ? AND sensor_type = ?
       ORDER BY id DESC LIMIT 1`,
      [device.id, pin]
    );
    if (rows.length) result[pin] = parseFloat(rows[0].value);
  }

  res.json(result);
}

async function deleteDevice(req, res) {
  const deviceId = parseInt(req.params.id);
  if (!deviceId) return res.status(400).json({ error: 'Invalid device id' });
  try {
    await deviceService.deleteDevice(deviceId, req.user.id);
    res.json({ message: 'Device deleted' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

module.exports = { register, list, pushData, sendCommand, ping, getDeviceState, deleteDevice };
