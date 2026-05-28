const db = require('./config/db');

const OFFLINE_TIMEOUT_SEC = 30;   // seconds of inactivity before marking offline
const CHECK_INTERVAL_MS   = 10_000;

function start(io) {
  setInterval(async () => {
    try {
      // Use GREATEST of last_ping_at and last_seen so that every data path
      // (HTTP POST /data, MQTT sensor, WebSocket device_data, explicit /ping)
      // contributes to the "last activity" timestamp. A device is stale only
      // when ALL of its activity timestamps are older than the threshold.
      // COALESCE(..., '2000-01-01') treats NULL as "very long ago" without
      // excluding newly-registered devices — those have is_online = 0 anyway.
      const [stale] = await db.query(`
        SELECT id, user_id FROM devices
        WHERE is_online = 1
          AND GREATEST(
                COALESCE(last_ping_at, '2000-01-01 00:00:00'),
                COALESCE(last_seen,    '2000-01-01 00:00:00')
              ) < DATE_SUB(NOW(), INTERVAL ? SECOND)
      `, [OFFLINE_TIMEOUT_SEC]);

      if (!stale.length) return;

      const ids = stale.map(d => d.id);
      await db.query(
        `UPDATE devices SET is_online = 0 WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );

      for (const device of stale) {
        const payload = { device_id: device.id, is_online: false };
        // user:{id} room → DevicesPage status badges
        io.to(`user:${device.user_id}`).emit('device_status', payload);
        // device:{id} room → any dashboard widget that shows connection state
        io.to(`device:${device.id}`).emit('device_status', payload);
      }

      console.log(`[heartbeat] Marked ${stale.length} device(s) offline:`, ids);
    } catch (err) {
      console.error('[heartbeat] Worker error:', err.message);
    }
  }, CHECK_INTERVAL_MS);

  console.log(`[heartbeat] Worker started — timeout: ${OFFLINE_TIMEOUT_SEC}s, check every: ${CHECK_INTERVAL_MS / 1000}s`);
}

module.exports = { start };
