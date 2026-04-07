'use strict';

const Zone   = require('../models/Zone');
const winston = require('winston');

/**
 * GET /api/geofences
 */
async function getGeofences(req, res, next) {
  try {
    const zones = await Zone.find({ userId: req.user.id });
    res.json(zones);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/geofences
 */
async function createGeofence(req, res, next) {
  try {
    const { type, name, centerLat, centerLon, radiusM, polygonCoords, isActive, isPrimary, zoneType, priorityLevel, fillColor, areaSqm } = req.body;
    
    // Check for unique name
    if (name) {
      const existing = await Zone.findOne({ userId: req.user.id, name });
      if (existing) {
        return res.status(400).json({ error: 'NAME_TAKEN', message: `Le nom "${name}" est déjà utilisé.` });
      }
    }

    // Convert to GeoJSON
    const geometry = {
      type: 'Polygon',
      coordinates: polygonCoords // Expected [[[lon, lat], ...]]
    };

    const center = {
      type: 'Point',
      coordinates: [centerLon, centerLat]
    };

    const zone = await Zone.create({
      userId: req.user.id,
      name,
      description: req.body.description,
      type: zoneType || 'grazing',
      geometry,
      center,
      radiusM,
      isActive: isActive !== undefined ? isActive : true,
      priorityLevel: priorityLevel || 1,
      fillColor: fillColor || '#4F46E5',
      areaSqm
    });
    
    res.status(201).json(zone);
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
    const { name, centerLat, centerLon, polygonCoords } = req.body;
    
    // Check for unique name (exclude self)
    if (name) {
      const existing = await Zone.findOne({ userId: req.user.id, name, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ error: 'NAME_TAKEN', message: `Le nom "${name}" est déjà utilisé pour une autre zone.` });
      }
    }

    const updateData = { ...req.body };
    
    if (polygonCoords) {
      updateData.geometry = {
        type: 'Polygon',
        coordinates: polygonCoords
      };
    }

    if (centerLat && centerLon) {
      updateData.center = {
        type: 'Point',
        coordinates: [centerLon, centerLat]
      };
    }

    const zone = await Zone.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    
    res.json(zone);
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
    const result = await Zone.deleteOne({ _id: id, userId: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Zone not found' });
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
