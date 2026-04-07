'use strict';

require('dotenv').config();
const { pool } = require('./src/config/database');

async function debug() {
  try {
    const [rows] = await pool.query('DESC geofences');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debug();
