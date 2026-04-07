'use strict';

require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  console.log('🚀 Migrating alerts table to support geofence_id...');
  try {
    // 1. Add column if not exists
    try {
      await pool.query('ALTER TABLE alerts ADD COLUMN geofence_id INT UNSIGNED DEFAULT NULL');
      console.log('✅ Column geofence_id added.');
    } catch (err) {
      if (err.code === 'ER_DUP_COLUMN_NAME') {
        console.log('ℹ️ Column already exists.');
      } else {
        throw err;
      }
    }

    // 2. Add foreign key
    try {
      await pool.query('ALTER TABLE alerts ADD CONSTRAINT fk_alert_geofence FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE SET NULL');
      console.log('✅ Foreign key fk_alert_geofence added.');
    } catch (err) {
      if (err.code === 'ER_DUP_KEY' || err.code === 'ER_FK_DUP_NAME' || err.message.includes('Duplicate')) {
        console.log('ℹ️ Foreign key already exists.');
      } else {
        throw err;
      }
    }

    console.log('🏁 Migration Complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration Failed:', err.message);
    process.exit(1);
  }
}

migrate();
