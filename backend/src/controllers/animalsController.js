'use strict';

const Animal       = require('../models/Animal');
const Zone         = require('../models/Zone');
const socketConfig = require('../config/socket');

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
    const { name, type, breed, weightKg, birthDate, rfidTag, deviceId, colorHex, currentZoneId } = req.body;

    // 1. Strict Duplicate Check (Professional Conflict Handling)
    if (deviceId && deviceId.trim()) {
      const existing = await Animal.findOne({ device_id: deviceId.trim() });
      if (existing) {
        return res.status(409).json({ 
          error: 'DUPLICATE_DEVICE', 
          field: 'device_id',
          message: `Le collier ${deviceId} est déjà assigné à ${existing.name}.` 
        });
      }
    }

    if (rfidTag && rfidTag.trim()) {
      const existing = await Animal.findOne({ rfid_tag: rfidTag.trim() });
      if (existing) {
        return res.status(409).json({ 
          error: 'DUPLICATE_DEVICE', 
          field: 'rfid_tag',
          message: `Le tag RFID ${rfidTag} est déjà utilisé.` 
        });
      }
    }

    // 2. Data Construction (Omit empty strings to satisfy sparse index)
    const animalData = {
      user_id: req.user.id,
      name,
      type,
      breed,
      weight_kg: weightKg,
      birth_date: birthDate,
      current_zone_id: currentZoneId || null,
      color_hex: colorHex || '#4CAF50',
      status: 'safe',
      last_seen: new Date(),
      last_sync: new Date()
    };

    if (rfidTag && rfidTag.trim())  animalData.rfid_tag  = rfidTag.trim();
    if (deviceId && deviceId.trim()) animalData.device_id = deviceId.trim();

    const animal = await Animal.create(animalData);

    // 3. Mark Device as Assigned in Inventory
    if (deviceId && deviceId.trim()) {
      const Device = require('../models/Device'); // Lazy load to avoid circular if any
      await Device.findOneAndUpdate(
        { device_id: deviceId.trim() },
        { $set: { status: 'assigned' } },
        { upsert: true } // Create if it didn't exist in inventory
      );
    }
    
    res.status(201).json(animal);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({ 
        error: 'DUPLICATE_DEVICE', 
        field, 
        message: 'Cette ressource matérielle est déjà assignée.' 
      });
    }
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
    
    // Remap camelCase
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

    // Sync device status if device_id changed
    if (updates.device_id) {
      const Device = require('../models/Device');
      await Device.findOneAndUpdate(
        { device_id: updates.device_id },
        { $set: { status: 'assigned' } },
        { upsert: true }
      );
    }

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

/**
 * POST /api/animals/:id/action
 * Trigger a real hardware actuator (buzzer, led, relay)
 */
async function triggerAction(req, res, next) {
  try {
    const { id } = req.params;
    const { type, state } = req.body; // type: 'buzzer'|'led'|'relay', state: boolean

    if (!['buzzer', 'led', 'relay'].includes(type)) {
      return res.status(400).json({ error: 'INVALID_ACTION', message: 'Action type must be buzzer, led, or relay' });
    }

    const animal = await Animal.findOneAndUpdate(
      { _id: id, user_id: req.user.id },
      { $set: { [`actuators.${type}`]: !!state } },
      { new: true }
    );

    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    // Broadcast update to Farmer app
    socketConfig.emitPositionUpdate(req.user.id, id, { actuators: animal.actuators });

    // BROADCAST to hardware!
    const io = socketConfig.getIO();
    io.to(`animal:${id}`).emit('actuator-command', { 
      type, 
      state: !!state,
      animalId: id 
    });

    res.json({ message: `Action ${type} sent to hardware`, actuators: animal.actuators });
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
  setZone,
  triggerAction
};
