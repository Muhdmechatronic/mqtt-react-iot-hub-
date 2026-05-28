-- ============================================================
-- Migration: Add access_type to datastreams (READ_ONLY / WRITE_ONLY / READ_WRITE)
-- Safe re-runnable pattern (PREPARE/EXECUTE + IF column exists)
-- ============================================================

USE iot_platform;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'datastreams'
    AND COLUMN_NAME  = 'access_type'
);

SET @sql := IF(@col_exists = 0,
  "ALTER TABLE datastreams
     ADD COLUMN access_type ENUM('READ_ONLY','WRITE_ONLY','READ_WRITE')
     NOT NULL DEFAULT 'READ_WRITE'
     AFTER data_type",
  'SELECT "access_type column already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
