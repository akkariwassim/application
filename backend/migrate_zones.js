'use strict';

require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  console.log('🚀 Starting Geofences Migration...');
  try {
    const columns = [
      'ALTER TABLE geofences ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT NULL',
      'ALTER TABLE geofences ADD COLUMN IF NOT EXISTS is_primary TINYINT(1) DEFAULT 0'
    ];

    for (const sql of columns) {
      try {
        // Compatibility for older MySQL versions that don't support ADD COLUMN IF NOT EXISTS
        const cleanSql = sql.replace('IF NOT EXISTS ', '');
        await pool.query(cleanSql);
        console.log(`✅ Executed: ${cleanSql}`);
      } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
          console.log(`ℹ️ Column already exists, skipping: ${sql.split(' ')[4]}`);
        } else {
          throw err;
        }
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
