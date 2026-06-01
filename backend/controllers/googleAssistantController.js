const jwt = require('jsonwebtoken');
const db   = require('../config/db');

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractUser(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try { return jwt.verify(header.slice(7), process.env.JWT_SECRET); }
  catch { return null; }
}

function deviceProfile(device) {
  const n = (device.name || '').toLowerCase();
  const t = (device.type || '').toLowerCase();

  if (t.includes('light') || n.includes('light') || n.includes('led') || n.includes('lamp') || n.includes('bulb')) {
    return {
      type:   'action.devices.types.LIGHT',
      traits: ['action.devices.traits.OnOff', 'action.devices.traits.Brightness'],
      attrs:  { brightnessUnitPercent: true },
    };
  }
  if (t.includes('fan') || n.includes('fan') || n.includes('blower')) {
    return {
      type:   'action.devices.types.FAN',
      traits: ['action.devices.traits.OnOff', 'action.devices.traits.FanSpeed'],
      attrs:  {
        availableFanSpeeds: {
          speeds: [
            { speed_name: 'low',    speed_values: [{ speed_synonym: ['low','slow'],           lang: 'en' }] },
            { speed_name: 'medium', speed_values: [{ speed_synonym: ['medium','half'],         lang: 'en' }] },
            { speed_name: 'high',   speed_values: [{ speed_synonym: ['high','fast','maximum'], lang: 'en' }] },
          ],
          ordered: true,
        },
        reversible: false,
      },
    };
  }
  if (n.includes('thermostat') || t.includes('therm')) {
    return {
      type:   'action.devices.types.THERMOSTAT',
      traits: ['action.devices.traits.TemperatureSetting'],
      attrs:  { availableThermostatModes: ['off','heat','cool','auto'], thermostatTemperatureUnit: 'C' },
    };
  }
  // Default — generic switch
  return {
    type:   'action.devices.types.SWITCH',
    traits: ['action.devices.traits.OnOff'],
    attrs:  {},
  };
}

// Publish via MQTT if gateway is available (non-fatal)
function mqttPublish(topic, payload) {
  try {
    const gw = require('../mqtt/gateway');
    if (typeof gw.publish === 'function') gw.publish(topic, payload);
  } catch { /* MQTT optional */ }
}

// ─── Intent handlers ────────────────────────────────────────────────────────

async function handleSync(requestId, user) {
  const [devices] = await db.query(
    'SELECT * FROM devices WHERE user_id = ? AND is_active = 1',
    [user.id]
  );

  const googleDevices = devices.map(d => {
    const { type, traits, attrs } = deviceProfile(d);
    return {
      id:    String(d.id),
      type,
      traits,
      name:  { defaultNames: [d.name], name: d.name, nicknames: [d.name] },
      willReportState: true,
      attributes: attrs,
      deviceInfo: {
        manufacturer: 'IoT Platform',
        model: d.board_type || 'ESP32',
        hwVersion: '1.0',
        swVersion: '2.0',
      },
      customData: { userId: user.id },
    };
  });

  return {
    requestId,
    payload: {
      agentUserId: String(user.id),
      devices: googleDevices,
    },
  };
}

async function handleQuery(requestId, payload) {
  const deviceIds = Object.keys(payload?.devices || {});
  const states = {};

  for (const deviceId of deviceIds) {
    const [deviceRows] = await db.query('SELECT * FROM devices WHERE id = ?', [parseInt(deviceId)]);
    if (!deviceRows.length) { states[deviceId] = { online: false, status: 'ERROR' }; continue; }

    const device = deviceRows[0];
    const { traits } = deviceProfile(device);

    const [sensorRows] = await db.query(
      `SELECT sensor_type, value FROM sensor_data
       WHERE device_id = ? ORDER BY recorded_at DESC LIMIT 30`,
      [parseInt(deviceId)]
    );

    const data = {};
    sensorRows.forEach(r => { if (!(r.sensor_type in data)) data[r.sensor_type] = r.value; });

    const state = { online: device.status === 'online', status: 'SUCCESS' };

    const raw0 = parseFloat(data['v0'] ?? data['relay'] ?? data['switch'] ?? data['power'] ?? 0);
    if (traits.includes('action.devices.traits.OnOff')) state.on = raw0 > 0;
    if (traits.includes('action.devices.traits.Brightness')) {
      const b = parseFloat(data['v1'] ?? data['brightness'] ?? data['led'] ?? 0);
      state.brightness = Math.min(100, Math.max(0, Math.round(b)));
    }
    if (traits.includes('action.devices.traits.TemperatureSetting')) {
      state.thermostatMode = 'auto';
      state.thermostatTemperatureAmbient = parseFloat(data['temperature'] ?? data['temp'] ?? 22);
      state.thermostatTemperatureSetpoint = parseFloat(data['setpoint'] ?? 22);
    }

    states[deviceId] = state;
  }

  return { requestId, payload: { devices: states } };
}

async function handleExecute(requestId, payload, io, userId) {
  const results = [];

  for (const command of payload?.commands || []) {
    for (const execution of command.execution || []) {
      for (const device of command.devices || []) {
        const deviceId = parseInt(device.id);

        try {
          const [deviceRows] = await db.query(
            'SELECT * FROM devices WHERE id = ? AND user_id = ?',
            [deviceId, userId]
          );
          if (!deviceRows.length) {
            results.push({ ids: [device.id], status: 'ERROR', errorCode: 'deviceNotFound' });
            continue;
          }

          const d    = deviceRows[0];
          const cmd  = execution.command;
          const prms = execution.params;

          let sensorType = 'v0';
          let value      = 0;
          let newState   = {};

          if (cmd === 'action.devices.commands.OnOff') {
            value      = prms.on ? 1 : 0;
            sensorType = 'v0';
            newState   = { on: prms.on };
          } else if (cmd === 'action.devices.commands.BrightnessAbsolute') {
            value      = Math.min(100, Math.max(0, prms.brightness));
            sensorType = 'v1';
            newState   = { brightness: value };
          } else if (cmd === 'action.devices.commands.SetFanSpeed') {
            const map  = { low: 33, medium: 66, high: 100 };
            value      = map[prms.fanSpeed] ?? 50;
            sensorType = 'v2';
            newState   = {};
          } else if (cmd === 'action.devices.commands.ThermostatTemperatureSetpoint') {
            value      = prms.thermostatTemperatureSetpoint;
            sensorType = 'setpoint';
            newState   = { thermostatTemperatureSetpoint: value };
          }

          // Persist to sensor_data so HTTP-polling ESP32s pick it up
          await db.query(
            `INSERT INTO sensor_data (device_id, sensor_type, value, unit, protocol, recorded_at)
             VALUES (?, ?, ?, '', 'command', NOW())
             ON DUPLICATE KEY UPDATE value = VALUES(value), recorded_at = VALUES(recorded_at)`,
            [deviceId, sensorType, String(value)]
          );

          // Real-time push via Socket.IO
          if (io) {
            io.emit('sensor_update', {
              device_id: deviceId,
              data: { [sensorType]: value },
              source: 'google_assistant',
            });
          }

          // Best-effort MQTT
          const topic = `iot/${d.token || deviceId}/set`;
          mqttPublish(topic, JSON.stringify({ pin: sensorType, value }));

          results.push({
            ids:    [device.id],
            status: 'SUCCESS',
            states: { online: true, ...newState },
          });
        } catch (err) {
          console.error('[GA Execute]', err.message);
          results.push({ ids: [device.id], status: 'ERROR', errorCode: 'hardError' });
        }
      }
    }
  }

  return { requestId, payload: { commands: results } };
}

// ─── Main fulfillment handler ────────────────────────────────────────────────

async function fulfillment(req, res) {
  const user = extractUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { requestId, inputs } = req.body;
  if (!inputs?.length) return res.status(400).json({ error: 'No inputs' });

  const intent  = inputs[0].intent;
  const payload = inputs[0].payload;

  try {
    let response;
    if      (intent === 'action.devices.SYNC')       response = await handleSync(requestId, user);
    else if (intent === 'action.devices.QUERY')      response = await handleQuery(requestId, payload);
    else if (intent === 'action.devices.EXECUTE')    response = await handleExecute(requestId, payload, req.io, user.id);
    else if (intent === 'action.devices.DISCONNECT') response = { requestId };
    else return res.status(400).json({ error: 'Unknown intent' });

    res.json(response);
  } catch (err) {
    console.error('[Google Assistant Fulfillment]', err.message);
    res.status(500).json({ error: 'Internal fulfillment error' });
  }
}

// ─── Request state report (called when device state changes) ─────────────────

async function reportState(req, res) {
  // Placeholder — real Report State requires Google Home Graph API integration
  // which needs a service account key. Return success so front-end polling works.
  res.json({ ok: true });
}

module.exports = { fulfillment, reportState };
