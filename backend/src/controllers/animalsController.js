'use strict';

const Animal = require('../models/Animal');
const Zone   = require('../models/Zone');

/**
 * GET /api/animals
 */
async function getAnimals(req, res, next) {
  try {
    const animals = await Animal.find({ user_id: req.user.id });
    res.json(animals);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/animals/:id
 */
async function getAnimal(req, res, next) {
  try {
    const { id } = req.params;
    const animal = await Animal.findOne({ _id: id, user_id: req.user.id });
    if (!animal) return res.status(404).json({ error: 'Animal not found' });
    res.json(animal);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals
 */
async function createAnimal(req, res, next) {
  try {
    const isAtZero = (lat, lon) => {
      const l = parseFloat(lat);
      const n = parseFloat(lon);
      return isNaN(l) || isNaN(n) || (Math.abs(l) < 0.001 && Math.abs(n) < 0.001);
    };

    let finalLat = parseFloat(latitude);
    let finalLon = parseFloat(longitude);
    
    if (isNaN(finalLat)) finalLat = 0;
    if (isNaN(finalLon)) finalLon = 0;

    // If assigned to a zone but no location provided (or at 0,0), center in zone
    if (currentZoneId && isAtZero(finalLat, finalLon)) {
      const zone = await Zone.findById(currentZoneId);
      if (zone) {
        if (zone.center_lat && zone.center_lon) {
          finalLat = zone.center_lat;
          finalLon = zone.center_lon;
        } else if (zone.polygon_coords) {
          // Fallback: calculate a simple center from polygon
          const coords = typeof zone.polygon_coords === 'string' ? JSON.parse(zone.polygon_coords) : zone.polygon_coords;
          if (coords.length > 0) {
            finalLat = coords.reduce((acc, c) => acc + c.latitude, 0) / coords.length;
            finalLon = coords.reduce((acc, c) => acc + c.longitude, 0) / coords.length;
          }
        }
      }
    }

    const animal = await Animal.create({
      user_id: req.user.id,
      name,
      type,
      breed,
      weight_kg: weightKg,
      birth_date: birthDate,
      rfid_tag: rfidTag,
      device_id: deviceId,
      color_hex: colorHex || '#4CAF50',
      notes,
      latitude: finalLat,
      longitude: finalLon,
      current_zone_id: currentZoneId || null,
      status: 'safe',
      last_seen: new Date()
    });
    
    res.status(201).json(animal);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/animals/:id
 */
async function updateAnimal(req, res, next) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Remap camelCase from frontend if needed
    if (updates.weightKg) { updates.weight_kg = updates.weightKg; delete updates.weightKg; }
    if (updates.birthDate) { updates.birth_date = updates.birthDate; delete updates.birthDate; }
    if (updates.rfidTag) { updates.rfid_tag = updates.rfidTag; delete updates.rfidTag; }
    if (updates.deviceId) { updates.device_id = updates.deviceId; delete updates.deviceId; }
    if (updates.colorHex) { updates.color_hex = updates.colorHex; delete updates.colorHex; }
    
    if (updates.currentZoneId) { 
      updates.current_zone_id = updates.currentZoneId; 
      delete updates.currentZoneId; 
    }

    const isAtZero = (lat, lon) => {
      const l = parseFloat(lat);
      const n = parseFloat(lon);
      return isNaN(l) || isNaN(n) || (Math.abs(l) < 0.001 && Math.abs(n) < 0.001);
    };

    // Auto-center if animal is currently at 0,0 and we have a zone
    const existing = await Animal.findOne({ _id: id, user_id: req.user.id });
    if (!existing) return res.status(404).json({ error: 'Animal not found' });

    const currentLat = updates.latitude !== undefined ? updates.latitude : existing.latitude;
    const currentLon = updates.longitude !== undefined ? updates.longitude : existing.longitude;
    const zoneId = updates.current_zone_id || existing.current_zone_id;

    if (zoneId && isAtZero(currentLat, currentLon)) {
      const zone = await Zone.findById(zoneId);
      if (zone) {
        if (zone.center_lat && zone.center_lon) {
          updates.latitude = zone.center_lat;
          updates.longitude = zone.center_lon;
        } else if (zone.polygon_coords) {
          const coords = typeof zone.polygon_coords === 'string' ? JSON.parse(zone.polygon_coords) : zone.polygon_coords;
          if (coords.length > 0) {
            updates.latitude = coords.reduce((acc, c) => acc + c.latitude, 0) / coords.length;
            updates.longitude = coords.reduce((acc, c) => acc + c.longitude, 0) / coords.length;
          }
        }
      }
    }

    const animal = await Animal.findOneAndUpdate(
      { _id: id, user_id: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!animal) return res.status(404).json({ error: 'Animal not found' });
    res.json(animal);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/animals/:id
 */
async function deleteAnimal(req, res, next) {
  try {
    const { id } = req.params;
    const result = await Animal.deleteOne({ _id: id, user_id: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Animal not found' });
    res.json({ message: 'Animal deleted successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/animals/:id/zone
 * Compatibility alias for mobile app
 */
async function getZone(req, res, next) {
  try {
    const { id } = req.params;
    const animal = await Animal.findOne({ _id: id, user_id: req.user.id });
    if (!animal || !animal.current_zone_id) return res.json(null);
    
    const zone = await Zone.findById(animal.current_zone_id);
    res.json(zone);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals/:id/geofence
 * Compatibility alias for setGeofence in mobile store
 */
async function setZone(req, res, next) {
  try {
    const { id } = req.params;
    const { geofenceId } = req.body;
    
    const animal = await Animal.findOneAndUpdate(
      { _id: id, user_id: req.user.id },
      { $set: { current_zone_id: geofenceId } },
      { new: true }
    );
    
    if (!animal) return res.status(404).json({ error: 'Animal not found' });
    res.json(animal);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAnimals,
  getAnimal,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  getZone,
  setZone
};
