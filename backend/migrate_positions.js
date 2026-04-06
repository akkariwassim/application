'use strict';

require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  console.log('🚀 Starting Positions Migration...');
  try {
    const columns = [
      'ALTER TABLE positions ADD COLUMN IF NOT EXISTS temperature_c DECIMAL(5,2) DEFAULT NULL',
      'ALTER TABLE positions ADD COLUMN IF NOT EXISTS activity_score INT DEFAULT NULL'
    ];

    for (const sql of columns) {
      try {
        // We use the same 'ADD COLUMN' but without 'IF NOT EXISTS' for compatibility if needed
        // but I'll try with IF NOT EXISTS first as it's cleaner if supported
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
