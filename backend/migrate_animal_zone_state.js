'use strict';

require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  console.log('🚀 Migrating animal zone state column...');
  try {
    // 1. Add column
    try {
      await pool.query('ALTER TABLE animals ADD COLUMN current_zone_id INT UNSIGNED DEFAULT NULL');
      console.log('✅ Column added.');
    } catch (err) {
      if (err.code === 'ER_DUP_COLUMN_NAME') {
        console.log('ℹ️ Column already exists.');
      } else {
        throw err;
      }
    }

    // 2. Add foreign key
    try {
      await pool.query('ALTER TABLE animals ADD CONSTRAINT fk_animal_zone FOREIGN KEY (current_zone_id) REFERENCES geofences(id) ON DELETE SET NULL');
      console.log('✅ Constraint added.');
    } catch (err) {
      if (err.code === 'ER_DUP_KEY' || err.code === 'ER_FK_DUP_NAME' || err.message.includes('Duplicate')) {
        console.log('ℹ️ Constraint already exists.');
      } else {
        throw err;
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
