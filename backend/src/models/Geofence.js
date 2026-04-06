'use strict';

const { pool } = require('../config/database');

const Geofence = {
  /**
   * Find all active geofences for a user.
   */
  async findByUser(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM geofences WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    return rows;
  },

  /**
   * Get the active geofence for an animal.
   * Checks both animal-specific and user-level zones.
   */
  async findByAnimal(animalId, userId) {
    const [rows] = await pool.query(
      `SELECT * FROM geofences 
       WHERE (animal_id = ? OR (animal_id IS NULL AND user_id = ?)) 
       AND is_active = 1 
       ORDER BY animal_id DESC LIMIT 1`,
      [animalId, userId]
    );
    return rows[0] || null;
  },

  /**
   * Create a new geofence.
   */
  async create({ userId, animalId, type, centerLat, centerLon, radiusM, polygonCoords }) {
    const [result] = await pool.query(
      `INSERT INTO geofences (user_id, animal_id, type, center_lat, center_lon, radius_m, polygon_coords, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, animalId || null, type || 'circle',
       centerLat     || null,
       centerLon     || null,
       radiusM       || null,
       polygonCoords ? JSON.stringify(polygonCoords) : null]
    );
    return result.insertId;
  },

  /**
   * Update an existing geofence.
   */
  async update(id, userId, { type, centerLat, centerLon, radiusM, polygonCoords, isActive }) {
    await pool.query(
      `UPDATE geofences 
       SET type = ?, center_lat = ?, center_lon = ?, radius_m = ?, polygon_coords = ?, is_active = ? 
       WHERE id = ? AND user_id = ?`,
      [type, centerLat, centerLon, radiusM, 
       polygonCoords ? JSON.stringify(polygonCoords) : null,
       isActive !== undefined ? isActive : 1,
       id, userId]
    );
  },

  /**
   * Delete a geofence.
   */
  async delete(id, userId) {
    await pool.query('DELETE FROM geofences WHERE id = ? AND user_id = ?', [id, userId]);
  }
};

module.exports = Geofence;
