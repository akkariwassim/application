'use strict';

require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  console.log('🚀 Starting Thresholds Migration...');
  try {
    const columns = [
      'ALTER TABLE animals ADD COLUMN min_temp DECIMAL(4,2) DEFAULT 37.5 AFTER breed',
      'ALTER TABLE animals ADD COLUMN max_temp DECIMAL(4,2) DEFAULT 40.0 AFTER min_temp',
      'ALTER TABLE animals ADD COLUMN min_activity INT DEFAULT 20 AFTER max_temp',
      'ALTER TABLE animals ADD COLUMN max_activity INT DEFAULT 80 AFTER min_activity'
    ];

    for (const sql of columns) {
      try {
        await pool.query(sql);
        console.log(`✅ Executed: ${sql}`);
      } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
          console.log(`ℹ️ Column already exists, skipping: ${sql.split(' ')[4]}`);
        } else {
          throw err;
        }
      }
    }

    // Also add 'type' filter for alerts if not already there (it should be)
    // and ensuring alert status has 'archived'
    await pool.query("ALTER TABLE alerts MODIFY COLUMN status ENUM('active','acknowledged','resolved','archived') DEFAULT 'active'");

    console.log('🏁 Migration Complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration Failed:', err.message);
    process.exit(1);
  }
}

migrate();
