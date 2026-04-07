'use strict';

require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  console.log('🚀 Finalizing Advanced Zones Migration (Fixed Types)...');
  try {
    const createEvents = `
      CREATE TABLE IF NOT EXISTS zone_events (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        geofence_id INT UNSIGNED NOT NULL,
        animal_id INT UNSIGNED NOT NULL,
        event_type ENUM('enter', 'exit') NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_geofence (geofence_id),
        INDEX idx_animal (animal_id),
        FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE CASCADE,
        FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await pool.query(createEvents);
    console.log('✅ zone_events table ensured (unsigned types).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create zone_events:', err.message);
    process.exit(1);
  }
}

migrate();
