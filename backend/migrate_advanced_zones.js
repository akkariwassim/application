'use strict';

require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  console.log('🚀 Starting Advanced Zones Migration (Resilient)...');
  try {
    // 1. Add missing columns to geofences (ignore errors if exists)
    const columns = [
      "ALTER TABLE geofences ADD COLUMN zone_type ENUM('grazing', 'water', 'rest', 'intensive', 'sensitive') DEFAULT 'grazing'",
      "ALTER TABLE geofences ADD COLUMN priority_level INT DEFAULT 1",
      "ALTER TABLE geofences ADD COLUMN area_sqm DECIMAL(12, 2) DEFAULT 0",
      "ALTER TABLE geofences ADD COLUMN fill_color VARCHAR(10) DEFAULT '#4F46E5'"
    ];

    for (const sql of columns) {
      try {
        await pool.query(sql);
        console.log(`✅ Executed: ${sql.substring(0, 40)}...`);
      } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
          console.log(`ℹ️ Column already exists, skipping.`);
        } else {
          console.warn(`⚠️ Warning: ${err.message}`);
        }
      }
    }

    // 2. Create zone_events table
    const createEvents = `
      CREATE TABLE IF NOT EXISTS zone_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        geofence_id INT NOT NULL,
        animal_id INT NOT NULL,
        event_type ENUM('enter', 'exit') NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_geofence (geofence_id),
        INDEX idx_animal (animal_id),
        FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE CASCADE,
        FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    try {
      await pool.query(createEvents);
      console.log('✅ zone_events table ensured.');
    } catch (err) {
      console.error('❌ Failed to create zone_events:', err.message);
    }

    console.log('🏁 Migration Complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration Failed:', err.message);
    process.exit(1);
  }
}

migrate();
