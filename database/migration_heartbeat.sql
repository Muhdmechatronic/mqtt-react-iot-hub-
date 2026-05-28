-- Add last_ping_at column to devices for heartbeat tracking
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'devices' AND COLUMN_NAME = 'last_ping_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE devices ADD COLUMN last_ping_at DATETIME NULL AFTER last_seen',
  'SELECT "last_ping_at column already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
