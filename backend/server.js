require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const { Server } = require('socket.io');
const db = require('./config/db');

const mqttGateway      = require('./mqtt/gateway');
const wsHandler        = require('./websocket/handler');
const heartbeatWorker  = require('./heartbeatWorker');
const authRoutes          = require('./routes/auth');
const deviceRoutes        = require('./routes/device');
const sensorRoutes        = require('./routes/sensor');
const dashboardRoutes     = require('./routes/dashboard');
const datastreamRoutes    = require('./routes/datastream');
const sandboxRoutes       = require('./routes/sandbox');
const googleAssistantRoutes     = require('./routes/googleAssistant');
const googleAssistantAuthRoutes = require('./routes/googleAssistantAuth');

// Support comma-separated origins or '*' for LAN / multi-device setups
const rawOrigin = process.env.FRONTEND_URL || '*';
const corsOrigin = rawOrigin === '*'
  ? '*'
  : rawOrigin.includes(',') ? rawOrigin.split(',').map(s => s.trim()) : rawOrigin;

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] }
});

// ---- middleware ----
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// ---- attach io to req so controllers can emit ----
app.use((req, _res, next) => { req.io = io; next(); });

// ---- routes ----
app.use('/api/auth',             authRoutes);
app.use('/api/device',           deviceRoutes);
app.use('/api/sensor',           sensorRoutes);
app.use('/api/dashboard',        dashboardRoutes);
app.use('/api/datastream',       datastreamRoutes);
app.use('/api/sandbox',          sandboxRoutes);
app.use('/api/google-assistant', googleAssistantRoutes);
app.use('/api/auth',            googleAssistantAuthRoutes); // adds /oauth + /token + /login endpoints

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ---- WebSocket handler ----
wsHandler(io);

// ---- MQTT gateway (passes io for realtime relay) ----
mqttGateway.start(io);

// ---- Heartbeat worker — marks stale devices offline ----
heartbeatWorker.start(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`IoT Platform backend running on port ${PORT}`));

// ---- Ensure default admin user has a valid password hash ----
// The schema.sql seed contained a placeholder hash that never matched "admin123".
// This fixes it automatically on every startup without touching real user accounts.
const PLACEHOLDER_HASH = '$2b$10$rOzJqX9K8Lm2N1pQ3vS5uOeY7wH4bM6jT0cU8dI2fG1hK5lN9mE3a';
async function ensureAdminUser() {
  try {
    const [rows] = await db.query(
      "SELECT id, password FROM users WHERE email = 'admin@iotplatform.local'"
    );
    if (!rows.length) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query(
        "INSERT INTO users (name, email, password, role) VALUES ('Admin', 'admin@iotplatform.local', ?, 'admin')",
        [hash]
      );
      console.log('[init] Admin user created — login: admin@iotplatform.local / admin123');
    } else if (rows[0].password === PLACEHOLDER_HASH) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query(
        "UPDATE users SET password = ? WHERE email = 'admin@iotplatform.local'",
        [hash]
      );
      console.log('[init] Admin password hash corrected — login: admin@iotplatform.local / admin123');
    }
  } catch (e) {
    console.warn('[init] ensureAdminUser failed:', e.message);
  }
}
ensureAdminUser();

// ── Idempotent column migration for access_type ───────────────────────────────
// Docker only runs schema.sql on a fresh volume. Any database initialised before
// this column was added will crash on datastream create/update without this fix.
async function ensureAccessTypeColumn() {
  try {
    const [cols] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'datastreams'
         AND COLUMN_NAME  = 'access_type'`
    );
    if (cols[0].cnt === 0) {
      await db.query(
        `ALTER TABLE datastreams
         ADD COLUMN access_type ENUM('READ_ONLY','WRITE_ONLY','READ_WRITE')
           NOT NULL DEFAULT 'READ_WRITE'
         AFTER data_type`
      );
      console.log('[init] datastreams.access_type column added');
    }
  } catch (e) {
    console.warn('[init] ensureAccessTypeColumn failed:', e.message);
  }
}
ensureAccessTypeColumn();

// ── Idempotent column migration for last_ping_at ──────────────────────────────
// Needed by heartbeatWorker. Old databases won't have this column.
async function ensureLastPingAtColumn() {
  try {
    const [cols] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'devices'
         AND COLUMN_NAME  = 'last_ping_at'`
    );
    if (cols[0].cnt === 0) {
      await db.query(
        `ALTER TABLE devices ADD COLUMN last_ping_at DATETIME NULL AFTER last_seen`
      );
      console.log('[init] devices.last_ping_at column added');
    }
  } catch (e) {
    console.warn('[init] ensureLastPingAtColumn failed:', e.message);
  }
}
ensureLastPingAtColumn();

// ── Idempotent enum migration: add 'command' to sensor_data.protocol ──────────
// Dashboard widgets (Switch, Slider, Push Button) persist their values to
// sensor_data with protocol='command' so the ESP32 HTTP poll can read them.
// Without this value in the enum, MySQL silently drops the row and onPin()
// callbacks never fire.
async function ensureCommandProtocol() {
  try {
    const [cols] = await db.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'sensor_data'
         AND COLUMN_NAME  = 'protocol'`
    );
    if (cols.length && !cols[0].COLUMN_TYPE.includes("'command'")) {
      await db.query(
        `ALTER TABLE sensor_data
         MODIFY COLUMN protocol
           ENUM('mqtt','http','websocket','command') NOT NULL DEFAULT 'mqtt'`
      );
      console.log("[init] sensor_data.protocol enum extended with 'command'");
    }
  } catch (e) {
    console.warn('[init] ensureCommandProtocol failed:', e.message);
  }
}
ensureCommandProtocol();

// ── Create sandbox_templates table if it doesn't exist ────────────────────────
async function ensureSandboxTemplatesTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS sandbox_templates (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id      INT UNSIGNED NOT NULL,
        name         VARCHAR(120) NOT NULL,
        widgets_json MEDIUMTEXT   NOT NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_sb_user_name (user_id, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('[init] sandbox_templates table ready');
  } catch (e) {
    console.warn('[init] ensureSandboxTemplatesTable failed:', e.message);
  }
}
ensureSandboxTemplatesTable();

// ── Google OAuth columns on users table ───────────────────────────────────────
async function ensureGoogleOAuthColumns() {
  try {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('google_id', 'avatar_url')`
    );
    const existing = cols.map(c => c.COLUMN_NAME);

    if (!existing.includes('google_id')) {
      await db.query(
        'ALTER TABLE users ADD COLUMN google_id VARCHAR(128) NULL UNIQUE AFTER email'
      );
      console.log('[init] users.google_id column added');
    }
    if (!existing.includes('avatar_url')) {
      await db.query(
        'ALTER TABLE users ADD COLUMN avatar_url TEXT NULL AFTER google_id'
      );
      console.log('[init] users.avatar_url column added');
    }

    // Allow password to be NULL for Google-only accounts
    const [pwCols] = await db.query(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password'`
    );
    if (pwCols.length && pwCols[0].IS_NULLABLE === 'NO') {
      await db.query(
        'ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL'
      );
      console.log('[init] users.password made nullable for OAuth accounts');
    }
  } catch (e) {
    console.warn('[init] ensureGoogleOAuthColumns failed:', e.message);
  }
}
ensureGoogleOAuthColumns();
