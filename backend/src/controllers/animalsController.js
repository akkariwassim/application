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
    const { name, type, breed, weightKg, birthDate, rfidTag, deviceId, colorHex, notes, latitude, longitude } = req.body;
    
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
      latitude: latitude || 0,
      longitude: longitude || 0,
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
    if (updates.currentZoneId) { updates.current_zone_id = updates.currentZoneId; delete updates.currentZoneId; }

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
