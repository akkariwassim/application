-- ============================================================
-- Smart Virtual Fence System — Database Schema
-- MySQL 8.0+  |  Charset: utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS smart_fence
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_fence;

-- ──────────────────────────────────────────────────────────────
-- Table: users
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100)    NOT NULL,
  email         VARCHAR(255)    NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  role          ENUM('admin','farmer') NOT NULL DEFAULT 'farmer',
  phone         VARCHAR(20)     NULL,
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────
-- Table: animals
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS animals (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED    NOT NULL,
  name          VARCHAR(100)    NOT NULL,
  type          ENUM('bovine','ovine','caprine','equine','other') NOT NULL DEFAULT 'bovine',
  breed         VARCHAR(100)    NULL,
  weight_kg     DECIMAL(6,2)    NULL,
  birth_date    DATE            NULL,
  rfid_tag      VARCHAR(50)     NULL,
  device_id     VARCHAR(50)     NULL COMMENT 'ESP32 device identifier',
  status        ENUM('safe','warning','danger','offline') NOT NULL DEFAULT 'offline',
  color_hex     VARCHAR(7)      NULL DEFAULT '#4CAF50',
  notes         TEXT            NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_animals_user   (user_id),
  KEY idx_animals_status (status),
  KEY idx_animals_device (device_id),
  CONSTRAINT fk_animals_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────
-- Table: geofences
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geofences (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  animal_id     INT UNSIGNED    NOT NULL,
  type          ENUM('circle','polygon') NOT NULL DEFAULT 'circle',
  center_lat    DECIMAL(10,7)   NULL COMMENT 'For circle type',
  center_lon    DECIMAL(10,7)   NULL COMMENT 'For circle type',
  radius_m      FLOAT           NULL COMMENT 'Radius in metres for circle type',
  polygon_coords JSON           NULL COMMENT 'Array of {lat,lon} for polygon type',
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_geofences_animal  (animal_id),
  KEY idx_geofences_active  (is_active),
  CONSTRAINT fk_geofences_animal FOREIGN KEY (animal_id)
    REFERENCES animals (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────
-- Table: positions
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS positions (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  animal_id     INT UNSIGNED    NOT NULL,
  latitude      DECIMAL(10,7)   NOT NULL,
  longitude     DECIMAL(10,7)   NOT NULL,
  accuracy_m    FLOAT           NULL,
  altitude_m    FLOAT           NULL,
  speed_mps     FLOAT           NULL,
  heading_deg   FLOAT           NULL,
  satellites    TINYINT         NULL,
  hdop          FLOAT           NULL,
  device_id     VARCHAR(50)     NULL,
  recorded_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                COMMENT 'Timestamp from the GPS device',
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_positions_animal_time (animal_id, recorded_at),
  KEY idx_positions_time        (recorded_at),
  -- Spatial-style covering index for lat/lon range queries
  KEY idx_positions_coords      (latitude, longitude),
  CONSTRAINT fk_positions_animal FOREIGN KEY (animal_id)
    REFERENCES animals (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────
-- Table: alerts
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  animal_id     INT UNSIGNED    NOT NULL,
  user_id       INT UNSIGNED    NOT NULL,
  type          ENUM('geofence_breach','low_battery','device_offline','unusual_movement','manual') NOT NULL,
  severity      ENUM('info','warning','critical') NOT NULL DEFAULT 'warning',
  message       TEXT            NOT NULL,
  latitude      DECIMAL(10,7)   NULL COMMENT 'Position at time of alert',
  longitude     DECIMAL(10,7)   NULL,
  status        ENUM('active','acknowledged','resolved','archived') NOT NULL DEFAULT 'active',
  acknowledged_at DATETIME      NULL,
  resolved_at   DATETIME        NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_alerts_animal   (animal_id),
  KEY idx_alerts_user     (user_id),
  KEY idx_alerts_status   (status),
  KEY idx_alerts_severity (severity),
  KEY idx_alerts_created  (created_at),
  CONSTRAINT fk_alerts_animal FOREIGN KEY (animal_id)
    REFERENCES animals (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_alerts_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────
-- Table: refresh_tokens
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED    NOT NULL,
  token_hash    VARCHAR(255)    NOT NULL,
  expires_at    DATETIME        NOT NULL,
  revoked       TINYINT(1)      NOT NULL DEFAULT 0,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rt_user    (user_id),
  KEY idx_rt_expires (expires_at),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────
-- Table: audit_logs
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED    NULL,
  action        VARCHAR(100)    NOT NULL,
  entity_type   VARCHAR(50)     NULL,
  entity_id     INT UNSIGNED    NULL,
  meta          JSON            NULL,
  ip_address    VARCHAR(45)     NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user   (user_id),
  KEY idx_audit_action (action),
  KEY idx_audit_time   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
