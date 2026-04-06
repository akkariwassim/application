-- ============================================================
-- Smart Virtual Fence System — Sample Data (Development)
-- Run AFTER schema.sql
-- ============================================================

USE smart_fence;

-- ──────────────────────────────────────────────────────────────
-- Users  (passwords hashed with bcrypt, rounds=10)
-- user1  → password: "Password123!"
-- user2  → password: "Admin@2024!"
-- ──────────────────────────────────────────────────────────────
INSERT INTO users (name, email, password_hash, role, phone) VALUES
('Ahmed Ben Ali',   'ahmed@farm.tn',  '$2b$10$KIx3e2N5NqZiP9m3.7XZEeD3mFWbH5Xr/kH3eRvQ0d3MdyPKfOXKu', 'farmer', '+21620000001'),
('Sara Trabelsi',   'sara@farm.tn',   '$2b$10$KIx3e2N5NqZiP9m3.7XZEeD3mFWbH5Xr/kH3eRvQ0d3MdyPKfOXKu', 'farmer', '+21620000002'),
('Super Admin',     'admin@fence.io', '$2b$10$KIx3e2N5NqZiP9m3.7XZEeD3mFWbH5Xr/kH3eRvQ0d3MdyPKfOXKu', 'admin',  NULL);

-- ──────────────────────────────────────────────────────────────
-- Animals
-- ──────────────────────────────────────────────────────────────
INSERT INTO animals (user_id, name, type, breed, weight_kg, birth_date, rfid_tag, device_id, status, color_hex) VALUES
(1, 'Bessie',   'bovine',  'Holstein',    450.0, '2020-03-15', 'RFID-001', 'ESP32_001', 'safe',    '#4CAF50'),
(1, 'Daisy',    'bovine',  'Montbéliarde',410.5, '2019-07-22', 'RFID-002', 'ESP32_002', 'warning', '#FF9800'),
(1, 'Bella',    'ovine',   'Mérinos',      65.0, '2021-01-10', 'RFID-003', 'ESP32_003', 'safe',    '#2196F3'),
(1, 'Rocky',    'caprine', 'Alpine',       42.0, '2022-05-30', 'RFID-004', 'ESP32_004', 'danger',  '#F44336'),
(2, 'Thunder',  'equine',  'Arabe',       520.0, '2018-11-05', 'RFID-005', 'ESP32_005', 'safe',    '#9C27B0');

-- ──────────────────────────────────────────────────────────────
-- Geofences  (centred near Sidi Bouzid, Tunisia)
-- ──────────────────────────────────────────────────────────────
INSERT INTO geofences (animal_id, type, center_lat, center_lon, radius_m, is_active) VALUES
(1, 'circle', 35.0380, 9.4845, 500,  1),
(2, 'circle', 35.0385, 9.4850, 500,  1),
(3, 'circle', 35.0375, 9.4840, 300,  1),
(4, 'circle', 35.0390, 9.4855, 300,  1),
(5, 'circle', 35.0370, 9.4835, 800,  1);

-- ──────────────────────────────────────────────────────────────
-- Positions (recent GPS readings)
-- ──────────────────────────────────────────────────────────────
INSERT INTO positions (animal_id, latitude, longitude, accuracy_m, altitude_m, speed_mps, satellites, hdop, device_id, recorded_at) VALUES
-- Bessie — inside geofence
(1, 35.0382, 9.4847, 5.0, 124.5, 0.3,  12, 1.2, 'ESP32_001', NOW() - INTERVAL 2 MINUTE),
(1, 35.0381, 9.4846, 4.8, 124.3, 0.5,  11, 1.3, 'ESP32_001', NOW() - INTERVAL 4 MINUTE),
(1, 35.0380, 9.4845, 5.1, 124.1, 0.2,  12, 1.1, 'ESP32_001', NOW() - INTERVAL 6 MINUTE),

-- Daisy — near boundary (warning)
(2, 35.0430, 9.4900, 6.0, 125.0, 1.2,  10, 1.5, 'ESP32_002', NOW() - INTERVAL 1 MINUTE),
(2, 35.0420, 9.4890, 5.5, 124.8, 0.9,  11, 1.4, 'ESP32_002', NOW() - INTERVAL 3 MINUTE),

-- Bella — inside
(3, 35.0377, 9.4841, 4.0, 123.0, 0.1,  13, 1.0, 'ESP32_003', NOW() - INTERVAL 2 MINUTE),

-- Rocky — OUTSIDE geofence (danger)
(4, 35.0500, 9.4950, 8.0, 126.0, 2.5,  9,  2.0, 'ESP32_004', NOW() - INTERVAL 30 SECOND),
(4, 35.0480, 9.4930, 7.5, 125.5, 2.1,  9,  1.9, 'ESP32_004', NOW() - INTERVAL 90 SECOND),

-- Thunder — inside
(5, 35.0372, 9.4837, 5.5, 122.5, 0.8,  11, 1.3, 'ESP32_005', NOW() - INTERVAL 3 MINUTE);

-- ──────────────────────────────────────────────────────────────
-- Alerts
-- ──────────────────────────────────────────────────────────────
INSERT INTO alerts (animal_id, user_id, type, severity, message, latitude, longitude, status) VALUES
(4, 1, 'geofence_breach', 'critical',
 'Rocky a franchi le périmètre de sécurité ! Distance: 620m du centre.',
 35.0500, 9.4950, 'active'),
(2, 1, 'geofence_breach', 'warning',
 'Daisy approche du bord du périmètre (distance : 490m / 500m).',
 35.0430, 9.4900, 'active'),
(1, 1, 'device_offline', 'info',
 'Bessie — Aucune donnée GPS reçue depuis 10 minutes.',
 35.0380, 9.4845, 'acknowledged');
