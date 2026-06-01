-- ============================================================
-- IoT Platform Database Schema  (single source of truth)
-- MySQL 8.0+   |   charset: utf8mb4_unicode_ci
-- Docker mounts this as /docker-entrypoint-initdb.d/schema.sql
-- and runs it ONCE on a fresh volume.
-- ============================================================

CREATE DATABASE IF NOT EXISTS iot_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE iot_platform;

-- ============================================================
-- USERS
-- password is NULL for Google-OAuth-only accounts
-- ============================================================
CREATE TABLE users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  google_id   VARCHAR(128) NULL UNIQUE,
  avatar_url  TEXT         NULL,
  password    VARCHAR(255) NULL,
  role        ENUM('admin','user') NOT NULL DEFAULT 'user',
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DEVICES
-- ============================================================
CREATE TABLE devices (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  name         VARCHAR(100) NOT NULL,
  device_type  VARCHAR(50)  NOT NULL DEFAULT 'generic',
  api_key      VARCHAR(64)  NOT NULL UNIQUE,
  is_online    TINYINT(1)   NOT NULL DEFAULT 0,
  last_seen    DATETIME     NULL,
  last_ping_at DATETIME     NULL,
  firmware     VARCHAR(50)  NULL,
  description  TEXT         NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id   (user_id),
  INDEX idx_api_key   (api_key),
  INDEX idx_is_online (is_online)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SENSOR DATA  (high-volume — index-heavy)
-- protocol='command' lets dashboard widgets persist values so
-- ESP32 HTTP poll can read them via onPin() callbacks.
-- ============================================================
CREATE TABLE sensor_data (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id   INT UNSIGNED NOT NULL,
  sensor_type VARCHAR(50)  NOT NULL,
  value       DOUBLE       NOT NULL,
  unit        VARCHAR(20)  NULL,
  protocol    ENUM('mqtt','http','websocket','command') NOT NULL DEFAULT 'mqtt',
  timestamp   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_device_time   (device_id, timestamp),
  INDEX idx_device_sensor (device_id, sensor_type),
  INDEX idx_timestamp     (timestamp),
  CONSTRAINT fk_sensor_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DASHBOARDS
-- ============================================================
CREATE TABLE dashboards (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT         NULL,
  is_default  TINYINT(1)   NOT NULL DEFAULT 0,
  layout_json JSON         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dashboards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DATASTREAMS  (Virtual Pin management — V0..V255)
-- Must be created BEFORE widgets (widgets FK references this table).
-- ============================================================
CREATE TABLE datastreams (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  device_id     INT UNSIGNED NOT NULL,
  virtual_pin   TINYINT UNSIGNED NOT NULL,
  name          VARCHAR(100) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  data_type     ENUM('integer','double','string') NOT NULL DEFAULT 'double',
  access_type   ENUM('READ_ONLY','WRITE_ONLY','READ_WRITE') NOT NULL DEFAULT 'READ_WRITE',
  unit          VARCHAR(30)  NULL,
  min_value     DOUBLE       NULL,
  max_value     DOUBLE       NULL,
  default_value VARCHAR(100) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ds_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_ds_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  UNIQUE KEY uq_device_pin  (device_id, virtual_pin),
  INDEX      idx_user_device (user_id, device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  position_x    SMALLINT     NOT NULL DEFAULT 0,
  position_y    SMALLINT     NOT NULL DEFAULT 0,
  width         SMALLINT     NOT NULL DEFAULT 2,
  height        SMALLINT     NOT NULL DEFAULT 2,
  settings_json JSON         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_widgets_user       FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  CONSTRAINT fk_widgets_dashboard  FOREIGN KEY (dashboard_id)  REFERENCES dashboards(id)  ON DELETE CASCADE,
  CONSTRAINT fk_widgets_device     FOREIGN KEY (device_id)     REFERENCES devices(id)     ON DELETE SET NULL,
  CONSTRAINT fk_widgets_datastream FOREIGN KEY (datastream_id) REFERENCES datastreams(id) ON DELETE SET NULL,
  INDEX idx_dashboard_id (dashboard_id),
  INDEX idx_user_id      (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SANDBOX TEMPLATES  (saved widget layout presets)
-- ============================================================
CREATE TABLE sandbox_templates (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  name         VARCHAR(120) NOT NULL,
  widgets_json MEDIUMTEXT   NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sb_user_name (user_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- COMMANDS  (relay / PWM / etc. sent to devices)
-- ============================================================
CREATE TABLE commands (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id    INT UNSIGNED NOT NULL,
  issued_by    INT UNSIGNED NOT NULL,
  command      VARCHAR(50)  NOT NULL,
  payload      JSON         NULL,
  status       ENUM('pending','delivered','failed') NOT NULL DEFAULT 'pending',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME     NULL,
  CONSTRAINT fk_commands_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  CONSTRAINT fk_commands_user   FOREIGN KEY (issued_by) REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_device_id  (device_id),
  INDEX idx_status     (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ALERTS  (threshold-based, future rule engine)
-- ============================================================
CREATE TABLE alerts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  device_id       INT UNSIGNED NOT NULL,
  sensor_type     VARCHAR(50)  NOT NULL,
  alert_condition ENUM('gt','lt','eq','gte','lte') NOT NULL,
  threshold       DOUBLE       NOT NULL,
  message         VARCHAR(255) NOT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  last_triggered  DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alerts_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_alerts_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_device_sensor (device_id, sensor_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DEVICE LOGS
-- ============================================================
CREATE TABLE device_logs (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id  INT UNSIGNED NOT NULL,
  level      ENUM('info','warn','error') NOT NULL DEFAULT 'info',
  message    TEXT         NOT NULL,
  protocol   VARCHAR(20)  NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_logs_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_device_id  (device_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED: default admin user
-- password is intentionally NULL here — server.js (ensureAdminUser)
-- inserts the correct bcrypt hash of "admin123" on first boot.
-- ============================================================
INSERT INTO users (name, email, password, role)
VALUES ('Admin', 'admin@iotplatform.local', NULL, 'admin');
