'use strict';

const { pool } = require('../config/database');

const Geofence = {
  /**
   * Find all active geofences for a user.
   */
  async findByUser(userId) {
    const [rows] = await pool.query(
      `SELECT g.*, 
              (SELECT COUNT(*) FROM alerts WHERE geofence_id = g.id AND status = 'active') as active_alerts
       FROM geofences g 
       WHERE g.user_id = ? 
       ORDER BY g.priority_level DESC, g.is_primary DESC, g.id DESC`,
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
  async create({ animalId, userId, type, name, radiusM, centerLat, centerLon, polygonCoords, isActive = 1, isPrimary = 0, zoneType = 'grazing', priorityLevel = 1, areaSqm = 0, fillColor = '#4F46E5' }) {
    const [result] = await pool.query(
      `INSERT INTO geofences (animal_id, user_id, type, name, radius_m, center_lat, center_lon, polygon_coords, is_active, is_primary, zone_type, priority_level, area_sqm, fill_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [animalId || null, userId, type, name || null, radiusM || null, centerLat, centerLon, JSON.stringify(polygonCoords) || null, isActive, isPrimary, zoneType, priorityLevel, areaSqm, fillColor]
    );
    return result.insertId;
  },

  /**
   * Update an existing geofence.
   */
  async update(id, userId, fields) {
    const { type, name, radiusM, centerLat, centerLon, polygonCoords, isActive, isPrimary, zoneType, priorityLevel, areaSqm, fillColor } = fields;
    
    // If setting as primary, unset others for this user
    if (isPrimary) {
      await pool.query('UPDATE geofences SET is_primary = 0 WHERE user_id = ?', [userId]);
    }

    const [result] = await pool.query(
      `UPDATE geofences SET
         type = ?, name = ?, radius_m = ?, center_lat = ?, center_lon = ?, 
         polygon_coords = ?, is_active = ?, is_primary = ?,
         zone_type = ?, priority_level = ?, area_sqm = ?, fill_color = ?
       WHERE id = ? AND user_id = ?`,
      [type, name || null, radiusM || null, centerLat, centerLon, 
       JSON.stringify(polygonCoords) || null, isActive, isPrimary,
       zoneType, priorityLevel, areaSqm, fillColor, id, userId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Delete a geofence.
   */
  async delete(id, userId) {
    await pool.query('DELETE FROM geofences WHERE id = ? AND user_id = ?', [id, userId]);
  },

  /**
   * Log an animal enter/exit event.
   */
  async logEvent(geofenceId, animalId, eventType) {
    await pool.query(
      'INSERT INTO zone_events (geofence_id, animal_id, event_type) VALUES (?, ?, ?)',
      [geofenceId, animalId, eventType]
    );
  },

  /**
   * Get historical events for zones.
   */
  async getEventsByZone(geofenceId, userId, limit = 50) {
    const [rows] = await pool.query(
      `SELECT e.*, a.name as animal_name, g.name as zone_name
       FROM zone_events e
       JOIN geofences g ON e.geofence_id = g.id
       JOIN animals a ON e.animal_id = a.id
       WHERE g.id = ? AND g.user_id = ?
       ORDER BY e.timestamp DESC LIMIT ?`,
      [geofenceId, userId, limit]
    );
    return rows;
  }
};

module.exports = Geofence;
