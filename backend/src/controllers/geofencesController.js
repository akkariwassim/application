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
    const { type, name, centerLat, centerLon, radiusM, polygonCoords, animalId, isPrimary } = req.body;
    
    // Check for unique name
    if (name) {
      const existing = await Geofence.findByName(req.user.id, name);
      if (existing) {
        return res.status(400).json({ error: 'NAME_TAKEN', message: `Le nom "${name}" est déjà utilisé.` });
      }
    }

    const geofenceId = await Geofence.create({
      userId: req.user.id,
      animalId,
      type: type || 'polygon',
      name,
      centerLat,
      centerLon,
      radiusM,
      polygonCoords,
      isPrimary: isPrimary ? 1 : 0
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
    const { type, name, centerLat, centerLon, radiusM, polygonCoords, isActive, isPrimary } = req.body;
    
    // Check for unique name (exclude self)
    if (name) {
      const existing = await Geofence.findByName(req.user.id, name);
      if (existing && existing.id !== parseInt(id)) {
        return res.status(400).json({ error: 'NAME_TAKEN', message: `Le nom "${name}" est déjà utilisé pour une autre zone.` });
      }
    }

    await Geofence.update(id, req.user.id, {
      type, name, centerLat, centerLon, radiusM, polygonCoords, isActive, isPrimary
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
