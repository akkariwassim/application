'use strict';

const { pool } = require('../config/database');

const Animal = {
  /**
   * List all animals for a user, including latest position.
   */
  async findByUser(userId) {
    const [rows] = await pool.query(
      `SELECT a.*,
              p.latitude, p.longitude, p.speed_mps, p.recorded_at AS last_seen,
              g.center_lat, g.center_lon, g.radius_m, g.type AS geofence_type
       FROM animals a
       LEFT JOIN positions p ON p.id = (
         SELECT id FROM positions WHERE animal_id = a.id ORDER BY recorded_at DESC LIMIT 1
       )
       LEFT JOIN geofences g ON g.animal_id = a.id AND g.is_active = 1
       WHERE a.user_id = ?
       ORDER BY a.name`,
      [userId]
    );
    return rows;
  },

  /**
   * Get a single animal (must belong to userId).
   */
  async findById(id, userId) {
    const [rows] = await pool.query(
      `SELECT a.*,
              p.latitude, p.longitude, p.speed_mps, p.recorded_at AS last_seen
       FROM animals a
       LEFT JOIN positions p ON p.id = (
         SELECT id FROM positions WHERE animal_id = a.id ORDER BY recorded_at DESC LIMIT 1
       )
       WHERE a.id = ? AND a.user_id = ?
       LIMIT 1`,
      [id, userId]
    );
    return rows[0] || null;
  },

  /**
   * Get an animal by device_id (for firmware POST /positions).
   */
  async findByDeviceId(deviceId) {
    const [rows] = await pool.query(
      'SELECT * FROM animals WHERE device_id = ? LIMIT 1',
      [deviceId]
    );
    return rows[0] || null;
  },

  /**
   * Create a new animal.
   */
  async create({ userId, name, type, breed, weightKg, birthDate, rfidTag, deviceId, colorHex, notes }) {
    const [result] = await pool.query(
      `INSERT INTO animals (user_id, name, type, breed, weight_kg, birth_date, rfid_tag, device_id, color_hex, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, type, breed || null, weightKg || null, birthDate || null,
       rfidTag || null, deviceId || null, colorHex || '#4CAF50', notes || null]
    );
    return result.insertId;
  },

  /**
   * Update an animal.
   */
  async update(id, userId, fields) {
    const { name, type, breed, weightKg, birthDate, rfidTag, deviceId, colorHex, notes } = fields;
    const [result] = await pool.query(
      `UPDATE animals SET
         name = ?, type = ?, breed = ?, weight_kg = ?, birth_date = ?,
         rfid_tag = ?, device_id = ?, color_hex = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [name, type, breed || null, weightKg || null, birthDate || null,
       rfidTag || null, deviceId || null, colorHex || '#4CAF50', notes || null,
       id, userId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Update animal status.
   */
  async updateStatus(id, status) {
    await pool.query('UPDATE animals SET status = ? WHERE id = ?', [status, id]);
  },

  /**
   * Delete an animal (only if owned by userId).
   */
  async delete(id, userId) {
    const [result] = await pool.query(
      'DELETE FROM animals WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
};

module.exports = Animal;
