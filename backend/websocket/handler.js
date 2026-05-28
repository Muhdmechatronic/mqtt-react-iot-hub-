const jwt           = require('jsonwebtoken');
const deviceService = require('../services/deviceService');
const sensorService = require('../services/sensorService');
const pinSync       = require('./pinSync');

function handler(io) {
  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      socket.disconnect(true);
      return;
    }

    socket.data.userId = user.id;
    socket.join(`user:${user.id}`);

    // ── Legacy sensor room subscription (unchanged) ───────────────────────────
    socket.on('subscribe_device', async ({ device_id }) => {
      socket.join(`device:${device_id}`);
    });

    socket.on('unsubscribe_device', ({ device_id }) => {
      socket.leave(`device:${device_id}`);
    });

    // ── Legacy WebSocket device data push (unchanged) ─────────────────────────
    socket.on('device_data', async ({ api_key, data, units, timestamp }) => {
      const device = await deviceService.getDeviceByApiKey(api_key);
      if (!device) return socket.emit('error', { message: 'Unknown device' });

      const unified = {
        device_id:  device.id,
        protocol:   'websocket',
        event_type: 'sensor',
        data,
        units:      units || {},
        timestamp:  timestamp || new Date().toISOString(),
      };

      await sensorService.saveSensorData(unified);
      await deviceService.updatePing(device.id);
      io.to(`device:${device.id}`).emit('sensor_update', unified);

      // Track which device this socket represents so disconnect can mark it offline.
      if (!socket.data.deviceId) {
        socket.data.deviceId = device.id;
        socket.data.deviceUserId = device.user_id;
      }
    });

    // ── Virtual pin omnidirectional sync ──────────────────────────────────────
    pinSync.registerHandlers(io, socket);

    // Immediately mark a WebSocket-connected device offline on TCP close.
    // Only fires for sockets that sent at least one device_data event.
    socket.on('disconnect', async () => {
      if (!socket.data.deviceId) return;
      await deviceService.markOnline(socket.data.deviceId, false);
      const offlinePayload = { device_id: socket.data.deviceId, is_online: false };
      io.to(`user:${socket.data.deviceUserId}`).emit('device_status', offlinePayload);
      io.to(`device:${socket.data.deviceId}`).emit('device_status', offlinePayload);
    });
  });
}

module.exports = handler;
