-- Migration 001: add 'command' to sensor_data.protocol enum
--
-- Dashboard widget commands (Switch, Slider, Push Button) write to sensor_data
-- with protocol='command' so the ESP32 HTTP poll can read the latest value.
-- The original enum only had 'mqtt','http','websocket', causing silent write
-- failures and breaking onPin() callbacks.
--
-- Run once against any database created before this migration:
--   mysql -u root -p iot_platform < database/migration_001_command_protocol.sql

ALTER TABLE sensor_data
  MODIFY COLUMN protocol
    ENUM('mqtt','http','websocket','command') NOT NULL DEFAULT 'mqtt';
