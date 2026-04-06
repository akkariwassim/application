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
  async create({ animalId, userId, type, name, radiusM, centerLat, centerLon, polygonCoords, isActive = 1, isPrimary = 0 }) {
    const [result] = await pool.query(
      `INSERT INTO geofences (animal_id, user_id, type, name, radius_m, center_lat, center_lon, polygon_coords, is_active, is_primary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [animalId || null, userId, type, name || null, radiusM || null, centerLat, centerLon, JSON.stringify(polygonCoords) || null, isActive, isPrimary]
    );
    return result.insertId;
  },

  /**
   * Update an existing geofence.
   */
  async update(id, userId, fields) {
    const { type, name, radiusM, centerLat, centerLon, polygonCoords, isActive, isPrimary } = fields;
    
    // If setting as primary, unset others for this user
    if (isPrimary) {
      await pool.query('UPDATE geofences SET is_primary = 0 WHERE user_id = ?', [userId]);
    }

    const [result] = await pool.query(
      `UPDATE geofences SET
         type = ?, name = ?, radius_m = ?, center_lat = ?, center_lon = ?, 
         polygon_coords = ?, is_active = ?, is_primary = ?
       WHERE id = ? AND user_id = ?`,
      [type, name || null, radiusM || null, centerLat, centerLon, 
       JSON.stringify(polygonCoords) || null, isActive, isPrimary, id, userId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Delete a geofence.
   */
  async delete(id, userId) {
    await pool.query('DELETE FROM geofences WHERE id = ? AND user_id = ?', [id, userId]);
  }
};

module.exports = Geofence;
