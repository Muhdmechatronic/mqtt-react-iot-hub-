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
    } else if (rows[0].password === null || rows[0].password === PLACEHOLDER_HASH) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query(
        "UPDATE users SET password = ? WHERE email = 'admin@iotplatform.local'",
        [hash]
      );
      console.log('[init] Admin password set — login: admin@iotplatform.local / admin123');
    }
  } catch (e) {
    console.warn('[init] ensureAdminUser failed:', e.message);
  }
}
ensureAdminUser();

// ---- Ensure OTP / pending-registration tables exist on existing volumes ----
async function ensureOTPTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email      VARCHAR(255) NOT NULL,
        otp        VARCHAR(64)  NOT NULL,
        type       ENUM('password_reset','reset_token') NOT NULL DEFAULT 'password_reset',
        expires_at DATETIME     NOT NULL,
        used       TINYINT(1)   NOT NULL DEFAULT 0,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_type (email, type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(100) NOT NULL,
        email      VARCHAR(255) NOT NULL UNIQUE,
        password   VARCHAR(255) NOT NULL,
        otp        VARCHAR(6)   NOT NULL,
        expires_at DATETIME     NOT NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (e) {
    console.warn('[init] ensureOTPTables failed:', e.message);
  }
}
ensureOTPTables();

