'use strict';

const { pool } = require('../config/database');

const Position = {
  /**
   * Insert a new GPS position.
   */
  async create({ animalId, latitude, longitude, accuracyM, altitudeM, speedMps,
                 headingDeg, satellites, hdop, temperatureC, activityScore, deviceId, recordedAt }) {
    const [result] = await pool.query(
      `INSERT INTO positions
         (animal_id, latitude, longitude, accuracy_m, altitude_m, speed_mps,
          heading_deg, satellites, hdop, temperature_c, activity_score, device_id, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [animalId, latitude, longitude,
       accuracyM  || null, altitudeM  || null, speedMps   || null,
       headingDeg || null, satellites || null, hdop       || null,
       temperatureC || null, activityScore || null,
       deviceId   || null, recordedAt || new Date()]
    );
    return result.insertId;
  },

  /**
   * Get the most recent position for an animal.
   */
  async findLatest(animalId) {
    const [rows] = await pool.query(
      `SELECT * FROM positions WHERE animal_id = ? ORDER BY recorded_at DESC LIMIT 1`,
      [animalId]
    );
    return rows[0] || null;
  },

  /**
   * Get position history with optional date filters.
   * @param {number} animalId
   * @param {Object} opts - { from, to, limit }
   */
  async findHistory(animalId, { from, to, limit = 100 } = {}) {
    let sql = 'SELECT * FROM positions WHERE animal_id = ?';
    const params = [animalId];

    if (from) { sql += ' AND recorded_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND recorded_at <= ?'; params.push(to);   }

    sql += ' ORDER BY recorded_at DESC LIMIT ?';
    params.push(Math.min(parseInt(limit) || 100, 1000));

    const [rows] = await pool.query(sql, params);
    return rows;
  }
};

module.exports = Position;
