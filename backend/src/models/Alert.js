'use strict';

const { pool } = require('../config/database');

const Alert = {
  /**
   * Create a new alert.
   */
  async create({ animalId, userId, type, severity, message, latitude, longitude }) {
    const [result] = await pool.query(
      `INSERT INTO alerts (animal_id, user_id, type, severity, message, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [animalId, userId, type, severity, message, latitude || null, longitude || null]
    );
    return result.insertId;
  },

  /**
   * Get alerts for a user with optional filters.
   */
  async findByUser(userId, { animalId, severity, status, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT al.*, an.name AS animal_name, an.type AS animal_type
      FROM alerts al
      JOIN animals an ON an.id = al.animal_id
      WHERE al.user_id = ?`;
    const params = [userId];

    if (animalId) { sql += ' AND al.animal_id = ?'; params.push(animalId); }
    if (severity) { sql += ' AND al.severity = ?';  params.push(severity);  }
    if (status)   { sql += ' AND al.status = ?';    params.push(status);    }

    sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(parseInt(limit) || 50, 200), parseInt(offset) || 0);

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  /**
   * Get a single alert (must belong to user).
   */
  async findById(id, userId) {
    const [rows] = await pool.query(
      `SELECT al.*, an.name AS animal_name
       FROM alerts al
       JOIN animals an ON an.id = al.animal_id
       WHERE al.id = ? AND al.user_id = ?
       LIMIT 1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  /**
   * Acknowledge an alert.
   */
  async acknowledge(id, userId) {
    const [result] = await pool.query(
      `UPDATE alerts SET status = 'acknowledged', acknowledged_at = NOW()
       WHERE id = ? AND user_id = ? AND status = 'active'`,
      [id, userId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Resolve an alert.
   */
  async resolve(id, userId) {
    const [result] = await pool.query(
      `UPDATE alerts SET status = 'resolved', resolved_at = NOW()
       WHERE id = ? AND user_id = ? AND status IN ('active','acknowledged')`,
      [id, userId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Delete an alert.
   */
  async delete(id, userId) {
    const [result] = await pool.query(
      'DELETE FROM alerts WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Count active alerts for an animal.
   */
  async countActive(animalId) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM alerts WHERE animal_id = ? AND status = 'active'`,
      [animalId]
    );
    return rows[0].cnt;
  }
};

module.exports = Alert;
