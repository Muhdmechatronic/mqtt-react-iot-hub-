-- ============================================================
-- IoT Platform Database Schema
-- MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS iot_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE iot_platform;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin','user') NOT NULL DEFAULT 'user',
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
);

-- ============================================================
-- DEVICES
-- ============================================================
CREATE TABLE devices (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  name        VARCHAR(100) NOT NULL,
  device_type VARCHAR(50) NOT NULL DEFAULT 'generic',
  api_key     VARCHAR(64) NOT NULL UNIQUE,
  is_online    TINYINT(1) NOT NULL DEFAULT 0,
  last_seen    DATETIME NULL,
  last_ping_at DATETIME NULL,
  firmware     VARCHAR(50) NULL,
  description TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id  (user_id),
  INDEX idx_api_key  (api_key),
  INDEX idx_is_online (is_online)
);

-- ============================================================
-- SENSOR DATA  (high-volume, index-heavy)
-- ============================================================
CREATE TABLE sensor_data (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id   INT UNSIGNED NOT NULL,
  sensor_type VARCHAR(50) NOT NULL,
  value       DOUBLE NOT NULL,
  unit        VARCHAR(20) NULL,
  protocol    ENUM('mqtt','http','websocket','command') NOT NULL DEFAULT 'mqtt',
  timestamp   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_device_time   (device_id, timestamp),
  INDEX idx_device_sensor (device_id, sensor_type),
  INDEX idx_timestamp     (timestamp),
  CONSTRAINT fk_sensor_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
)
-- Partition by month for multi-million-row performance (optional, enable when needed)
-- PARTITION BY RANGE (UNIX_TIMESTAMP(timestamp)) (
--   PARTITION p_2024_01 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
--   PARTITION p_future  VALUES LESS THAN MAXVALUE
-- )
;

-- ============================================================
-- DASHBOARDS
-- ============================================================
CREATE TABLE dashboards (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT NULL,
  is_default  TINYINT(1) NOT NULL DEFAULT 0,
  layout_json JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dashboards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);

-- ============================================================
-- WIDGETS  (database-driven, no hardcoded UI)
-- ============================================================
CREATE TABLE widgets (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  dashboard_id  INT UNSIGNED NOT NULL,
  type          ENUM('button','switch','gauge','linechart','slider','label','status','led','progressbar') NOT NULL,
  title         VARCHAR(100) NOT NULL,
  device_id     INT UNSIGNED NULL,
  datastream_id INT UNSIGNED NULL,
  data_key      VARCHAR(100) NULL,
  mqtt_topic    VARCHAR(200) NULL,
  position_x    SMALLINT NOT NULL DEFAULT 0,
  position_y    SMALLINT NOT NULL DEFAULT 0,
  width         SMALLINT NOT NULL DEFAULT 2,
  height        SMALLINT NOT NULL DEFAULT 2,
  settings_json JSON NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_widgets_user       FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  CONSTRAINT fk_widgets_dashboard  FOREIGN KEY (dashboard_id)  REFERENCES dashboards(id)  ON DELETE CASCADE,
  CONSTRAINT fk_widgets_device     FOREIGN KEY (device_id)     REFERENCES devices(id)     ON DELETE SET NULL,
  CONSTRAINT fk_widgets_datastream FOREIGN KEY (datastream_id) REFERENCES datastreams(id) ON DELETE SET NULL,
  INDEX idx_dashboard_id (dashboard_id),
  INDEX idx_user_id      (user_id)
);

-- ============================================================
-- DATASTREAMS  (Virtual Pin management — V0..V255)
-- ============================================================
CREATE TABLE datastreams (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  device_id     INT UNSIGNED NOT NULL,
  virtual_pin   TINYINT UNSIGNED NOT NULL,          -- 0–255
  name          VARCHAR(100) NOT NULL,              -- system identifier  e.g. "temperature"
  display_name  VARCHAR(100) NOT NULL,              -- human label        e.g. "Room Temp"
  data_type     ENUM('integer','double','string') NOT NULL DEFAULT 'double',
  access_type   ENUM('READ_ONLY','WRITE_ONLY','READ_WRITE') NOT NULL DEFAULT 'READ_WRITE',
  unit          VARCHAR(30) NULL,
  min_value     DOUBLE NULL,
  max_value     DOUBLE NULL,
  default_value VARCHAR(100) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ds_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_ds_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  UNIQUE  KEY uq_device_pin  (device_id, virtual_pin),
  INDEX idx_user_device (user_id, device_id)
);

-- ============================================================
-- COMMANDS  (relay / PWM / etc. sent to devices)
-- ============================================================
CREATE TABLE commands (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id   INT UNSIGNED NOT NULL,
  issued_by   INT UNSIGNED NOT NULL,
  command     VARCHAR(50) NOT NULL,
  payload     JSON NULL,
  status      ENUM('pending','delivered','failed') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME NULL,
  CONSTRAINT fk_commands_device FOREIGN KEY (device_id)  REFERENCES devices(id) ON DELETE CASCADE,
  CONSTRAINT fk_commands_user   FOREIGN KEY (issued_by)  REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_device_id  (device_id),
  INDEX idx_status     (status),
  INDEX idx_created_at (created_at)
);

-- ============================================================
-- ALERTS  (threshold-based, future rule engine)
-- ============================================================
CREATE TABLE alerts (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  device_id   INT UNSIGNED NOT NULL,
  sensor_type VARCHAR(50) NOT NULL,
  alert_condition ENUM('gt','lt','eq','gte','lte') NOT NULL,
  threshold   DOUBLE NOT NULL,
  message     VARCHAR(255) NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  last_triggered DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alerts_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_alerts_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_device_sensor (device_id, sensor_type)
);

-- ============================================================
-- DEVICE LOGS
-- ============================================================
CREATE TABLE device_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id   INT UNSIGNED NOT NULL,
  level       ENUM('info','warn','error') NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  protocol    VARCHAR(20) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_logs_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_device_id  (device_id),
  INDEX idx_created_at (created_at)
);

-- ============================================================
-- WIDGET SETTINGS_JSON SCHEMAS  (stored as JSON in widgets.settings_json)
-- Each widget type inherits min, max, unit from its linked datastream
-- unless explicit overrides are provided.
-- ============================================================
/*

─── GAUGE ────────────────────────────────────────────────────
{
  "datastreamId":    3,
  "title":           "Room Temperature",
  "overrideMinMax":  true,
  "customMin":       0,
  "customMax":       50,
  "colorBasedOnValue": true,
  "colorThresholds": [
    { "id": 1, "threshold": 0,  "colorHex": "#22c55e" },
    { "id": 2, "threshold": 30, "colorHex": "#f59e0b" },
    { "id": 3, "threshold": 42, "colorHex": "#ef4444" }
  ],
  "gradientMode":    "smooth"   -- "smooth" | "step"
}

─── SLIDER ───────────────────────────────────────────────────
{
  "datastreamId":     5,
  "title":            "Fan Speed",
  "sendOnReleaseOnly": false,
  "handleStep":       0.1,
  "showFineControls": true,
  "valuePosition":    "right"   -- "left" | "right"
  -- Bounds (min/max/unit) are LOCKED to the datastream — not stored here.
}

─── CHART ────────────────────────────────────────────────────
{
  "datastreamId":  2,
  "title":         "CO₂ Trend",
  "chartType":     "area",      -- "line" | "area" | "bar"
  "timeWindow":    "24h",       -- "live" | "1h" | "6h" | "24h" | "7d"
  "colorHex":      "#38bdf8",
  "showDots":      false,
  "smoothCurve":   true
}

─── SWITCH ───────────────────────────────────────────────────
{
  "datastreamId":   4,
  "title":          "Pump Control",
  "onValue":        "1",
  "offValue":       "0",
  "showLabels":     true,
  "onLabel":        "Running",
  "offLabel":       "Stopped",
  "labelPosition":  "right",
  "hideTitle":      false,
  "color":          "#22c55e",
  "command":        "relay"
}

─── BUTTON ───────────────────────────────────────────────────
{
  "datastreamId":   5,
  "title":          "Trigger",
  "onValue":        "1",
  "offValue":       "0",
  "showLabels":     false,
  "color":          "#0ea5e9",
  "command":        "relay"
}

─── LED ──────────────────────────────────────────────────────
{
  "datastreamId":   5,
  "title":          "Status",
  "colorOn":        "#22c55e",
  "colorOff":       "#1e293b",
  "ledMode":        "binary",   -- "binary" | "pwm"
  "threshold":      0.5,        -- binary: value >= threshold → ON
  "pwmMin":         0,          -- pwm: opacity 0 at this value
  "pwmMax":         100         -- pwm: opacity 1 at this value
}

─── SLIDER ─── (see SLIDER above, repeated for clarity)
{
  "datastreamId":   6,
  "title":          "Fan Speed",
  "sendOnReleaseOnly": false,
  "handleStep":     1,
  "showFineControls": false,
  "valuePosition":  "right"
}

*/

-- ============================================================
-- SEED: default admin user  (password: admin123 — change in production)
-- password hash = bcrypt of "admin123"
-- ============================================================
INSERT INTO users (name, email, password, role) VALUES
  ('Admin', 'admin@iotplatform.local', '$2b$10$rOzJqX9K8Lm2N1pQ3vS5uOeY7wH4bM6jT0cU8dI2fG1hK5lN9mE3a', 'admin');
