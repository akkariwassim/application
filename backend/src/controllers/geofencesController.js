'use strict';

const Geofence = require('../models/Geofence');
const logger   = require('../utils/logger');

/**
 * GET /api/geofences
 */
async function getGeofences(req, res, next) {
  try {
    const geofences = await Geofence.findByUser(req.user.id);
    res.json(geofences);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/geofences
 */
async function createGeofence(req, res, next) {
  try {
    const { type, centerLat, centerLon, radiusM, polygonCoords, animalId } = req.body;
    
    const geofenceId = await Geofence.create({
      userId: req.user.id,
      animalId,
      type: type || 'polygon',
      centerLat,
      centerLon,
      radiusM,
      polygonCoords
    });
    
    res.status(201).json({ id: geofenceId, message: 'Geofence created successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/geofences/:id
 */
async function updateGeofence(req, res, next) {
  try {
    const { id } = req.params;
    const { type, centerLat, centerLon, radiusM, polygonCoords, isActive } = req.body;
    
    await Geofence.update(id, req.user.id, {
      type, centerLat, centerLon, radiusM, polygonCoords, isActive
    });
    
    res.json({ message: 'Geofence updated successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/geofences/:id
 */
async function deleteGeofence(req, res, next) {
  try {
    const { id } = req.params;
    await Geofence.delete(id, req.user.id);
    res.json({ message: 'Geofence deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence
};
