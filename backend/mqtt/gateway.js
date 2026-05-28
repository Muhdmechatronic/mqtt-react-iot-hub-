const mqtt          = require('mqtt');
const deviceService = require('../services/deviceService');
const sensorService = require('../services/sensorService');
const pinSync       = require('../websocket/pinSync');
const { coerceValue, inferValueType } = require('../utils/coerce');

let client;
let ioRef;

function start(io) {
  ioRef = io;

  const brokerUrl = `mqtt://${process.env.MQTT_HOST || 'localhost'}:${process.env.MQTT_PORT || 1883}`;
  client = mqtt.connect(brokerUrl, {
    username:        process.env.MQTT_USERNAME || undefined,
    password:        process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 5000,
    connectTimeout:  10000,
  });

  client.on('connect', () => {
    console.log('[MQTT] Connected to broker');
    client.subscribe('iot/+/sensor',  { qos: 1 });
    client.subscribe('iot/+/status',  { qos: 0 });
    client.subscribe('iot/+/relay',   { qos: 1 });
    // Virtual pin writes from hardware: iot/{api_key}/pin/{0-255}
    client.subscribe('iot/+/pin/+',   { qos: 1 });
  });

  client.on('message', handleMessage);
  client.on('error',   (err) => console.error('[MQTT] Error:', err.message));
  client.on('offline', ()    => console.warn('[MQTT] Offline'));
  client.on('reconnect', ()  => console.log('[MQTT] Reconnecting...'));
}

async function handleMessage(topic, buffer) {
  let payload;
  try { payload = JSON.parse(buffer.toString()); }
  catch { return console.warn('[MQTT] Non-JSON payload on', topic); }

  const parts       = topic.split('/');
  const deviceIdent = parts[1];
  const event_type  = parts[2];

  const device = await deviceService.getDeviceByApiKey(deviceIdent);
  if (!device) return console.warn('[MQTT] Unknown device:', deviceIdent);

  // ── Virtual pin write from hardware ───────────────────────────────────────
  // Topic: iot/{api_key}/pin/{virtualPin}
  // Payload: { value, valueType?, originId?, timestamp?, seq? }
  if (event_type === 'pin') {
    const virtualPin = parseInt(parts[3]);
    if (isNaN(virtualPin) || virtualPin < 0 || virtualPin > 255) return;

    // Hardware sends its MAC address as originId; fallback to api_key.
    // This prevents the server from reflecting the update back to the same device.
    const originId  = String(payload.originId || deviceIdent);
    const rawValue  = payload.value !== undefined ? payload.value : payload;
    const valueType = payload.valueType || inferValueType(rawValue);
    const value     = coerceValue(rawValue, valueType);

    const pinPayload = {
      schema:     'iot/pin/v1',
      event:      'WRITE',
      originId,
      deviceId:   String(device.id),
      virtualPin,
      widgetId:   null,
      value,
      valueType,
      timestamp:  Number.isInteger(payload.timestamp) ? payload.timestamp : Date.now(),
      seq:        Number.isInteger(payload.seq) ? payload.seq : 0,
    };

    pinSync.setCached(String(device.id), virtualPin, pinPayload);
    // updatePing keeps last_ping_at fresh so the heartbeat sweeper can detect
    // when this MQTT device goes silent.
    await deviceService.updatePing(device.id);

    // No originSocketId to exclude — broadcast to every subscriber.
    pinSync.broadcastPinUpdateFromExternal(ioRef, pinPayload);
    return;
  }

  // ── Legacy handlers (unchanged) ───────────────────────────────────────────
  const unified = {
    device_id:  device.id,
    protocol:   'mqtt',
    event_type,
    data:       payload.data || payload,
    units:      payload.units  || {},
    timestamp:  payload.timestamp || new Date().toISOString(),
  };

  if (event_type === 'sensor') {
    await sensorService.saveSensorData(unified);
    await deviceService.updatePing(device.id);
    ioRef.to(`device:${device.id}`).emit('sensor_update', unified);
  }

  if (event_type === 'status') {
    const isOnline = payload.status === 'online';
    if (isOnline) {
      await deviceService.updatePing(device.id);
    } else {
      await deviceService.markOnline(device.id, false);
    }
    // Emit to user:{id} room so DevicesPage status badges update, and to
    // device:{id} room so dashboard widgets also receive the status change.
    const statusPayload = { device_id: device.id, is_online: isOnline };
    ioRef.to(`user:${device.user_id}`).emit('device_status', statusPayload);
    ioRef.to(`device:${device.id}`).emit('device_status', statusPayload);
  }
}

// Publish a command to a device (legacy relay/PWM commands).
function publishCommand(deviceApiKey, command, payload) {
  if (!client?.connected) return false;
  const topic = `iot/${deviceApiKey}/command`;
  client.publish(topic, JSON.stringify({ command, payload }), { qos: 1 });
  return true;
}

// Push a pin value DOWN to hardware — used when the server needs to
// resync hardware state after a reconnect (server-to-device direction).
function publishPinSync(deviceApiKey, virtualPin, value, valueType) {
  if (!client?.connected) return false;
  const topic = `iot/${deviceApiKey}/pin/${virtualPin}/set`;
  client.publish(topic, JSON.stringify({ value, valueType, timestamp: Date.now() }), { qos: 1 });
  return true;
}

module.exports = { start, publishCommand, publishPinSync };
