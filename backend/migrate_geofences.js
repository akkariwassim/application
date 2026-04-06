'use strict';
require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  try {
    console.log('🚀 Starting geofence migration...');
    
    // 1. Add user_id column
    await pool.query(`
      ALTER TABLE geofences 
      ADD COLUMN user_id INT UNSIGNED AFTER id;
    `);
    console.log('✅ Added user_id column');

    // 2. Make animal_id nullable
    await pool.query(`
      ALTER TABLE geofences 
      MODIFY COLUMN animal_id INT UNSIGNED NULL;
    `);
    console.log('✅ Modified animal_id to be nullable');

    // 3. Add foreign key for user_id
    await pool.query(`
      ALTER TABLE geofences 
      ADD CONSTRAINT fk_geofences_user 
      FOREIGN KEY (user_id) REFERENCES users(id) 
      ON DELETE CASCADE;
    `);
    console.log('✅ Added foreign key for user_id');

    console.log('🎉 Migration successful!');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ Column already exists, skipping...');
      process.exit(0);
    }
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
