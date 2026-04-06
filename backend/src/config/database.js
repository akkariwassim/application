'use strict';

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || '127.0.0.1',
  port:               parseInt(process.env.DB_PORT) || 3306,
  database:           process.env.DB_NAME     || 'smart_fence',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           'Z',            // store timestamps as UTC
  decimalNumbers:     true
});

/**
 * Test the database connection at startup.
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    logger.info('✅ MySQL connected successfully');
    conn.release();
  } catch (err) {
    logger.error('❌ MySQL connection failed:', err.message);
    throw err;
  }
}

module.exports = { pool, testConnection };
