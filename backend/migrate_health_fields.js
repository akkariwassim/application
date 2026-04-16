'use strict';

require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  console.log('🚀 Starting Health Fields Migration for MySQL Positions...');
  
  const columns = [
    'ALTER TABLE positions ADD COLUMN heart_rate INT DEFAULT NULL',
    'ALTER TABLE positions ADD COLUMN battery_level INT DEFAULT NULL',
    'ALTER TABLE positions ADD COLUMN gps_signal INT DEFAULT NULL'
  ];

  for (const sql of columns) {
    try {
      await pool.query(sql);
      console.log(`✅ Executed: ${sql}`);
    } catch (err) {
      if (err.code === 'ER_DUP_COLUMN_NAME') {
        const colName = sql.split(' ')[4];
        console.log(`ℹ️ Column already exists, skipping: ${colName}`);
      } else {
        console.error(`❌ Error executing ${sql}:`, err.message);
      }
    }
  }

  console.log('🏁 Health Fields Migration Complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Critical Migration Failure:', err);
  process.exit(1);
});
