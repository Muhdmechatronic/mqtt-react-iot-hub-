-- ============================================================
-- Migration: Add Datastreams (Virtual Pin management)
-- MySQL 8.0 Safe Version (Re-runnable)
-- ============================================================

USE iot_platform;

-- ============================================================
-- 1. Create datastreams table
-- ============================================================
CREATE TABLE IF NOT EXISTS datastreams (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  device_id     INT UNSIGNED NOT NULL,
  virtual_pin   TINYINT UNSIGNED NOT NULL,
  name          VARCHAR(100) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  data_type     ENUM('integer','double','string') NOT NULL DEFAULT 'double',
  unit          VARCHAR(30) NULL,
  min_value     DOUBLE NULL,
  max_value     DOUBLE NULL,
  default_value VARCHAR(100) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_device_pin (device_id, virtual_pin),
  INDEX idx_user_device (user_id, device_id)
) ENGINE=InnoDB;


-- ============================================================
-- 2. Add foreign keys for datastreams (safe check)
-- ============================================================

-- Add FK: user_id -> users.id
SET @fk_user_exists := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'iot_platform'
    AND TABLE_NAME = 'datastreams'
    AND CONSTRAINT_NAME = 'fk_ds_user'
);

SET @sql := IF(@fk_user_exists = 0,
  'ALTER TABLE datastreams 
     ADD CONSTRAINT fk_ds_user 
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  'SELECT "fk_ds_user exists"');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- Add FK: device_id -> devices.id
SET @fk_device_exists := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'iot_platform'
    AND TABLE_NAME = 'datastreams'
    AND CONSTRAINT_NAME = 'fk_ds_device'
);

SET @sql := IF(@fk_device_exists = 0,
  'ALTER TABLE datastreams 
     ADD CONSTRAINT fk_ds_device 
     FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE',
  'SELECT "fk_ds_device exists"');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================
-- 3. Add datastream_id column to widgets (safe)
-- ============================================================

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'iot_platform'
    AND TABLE_NAME = 'widgets'
    AND COLUMN_NAME = 'datastream_id'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE widgets ADD COLUMN datastream_id INT UNSIGNED NULL AFTER device_id',
  'SELECT "datastream_id exists"');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================
-- 4. Add FK for widgets -> datastreams (safe)
-- ============================================================

SET @fk_widget_ds_exists := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'iot_platform'
    AND TABLE_NAME = 'widgets'
    AND CONSTRAINT_NAME = 'fk_widgets_datastream'
);

SET @sql := IF(@fk_widget_ds_exists = 0,
  'ALTER TABLE widgets 
     ADD CONSTRAINT fk_widgets_datastream 
     FOREIGN KEY (datastream_id) REFERENCES datastreams(id) 
     ON DELETE SET NULL',
  'SELECT "fk_widgets_datastream exists"');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================
-- 5. Expand widget types safely (MySQL ENUM rewrite)
-- ============================================================

-- NOTE: MySQL cannot "append" ENUM values safely, so we redefine full list

ALTER TABLE widgets
  MODIFY COLUMN type
  ENUM(
    'button',
    'switch',
    'gauge',
    'linechart',
    'slider',
    'label',
    'status',
    'led',
    'progressbar'
  ) NOT NULL;

-- ============================================================
-- END MIGRATION
-- ============================================================