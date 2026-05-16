'use strict';

const mongoose = require('mongoose');
const Animal = require('../models/Animal');
const Zone   = require('../models/Zone');
const Device = require('../models/Device');
const socketConfig = require('../config/socket');
const zoneMonitorService = require('../services/zoneMonitorService');
const logger = require('../utils/logger');
const response = require('../utils/responseHelper');

/**
 * GET /api/animals
 * Supports: pagination, search, sorting, and filtering
 */
async function getAnimals(req, res, next) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status, 
      type, 
      zone_id,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const query = { farm_id: req.farm_id };

    if (status) query.status = status;
    if (type)   query.type = type;
    if (zone_id) query.current_zone_id = zone_id;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { device_id: { $regex: search, $options: 'i' } },
        { rfid_tag: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitInt = parseInt(limit);

    const [animals, total, stats] = await Promise.all([
      Animal.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limitInt),
      Animal.countDocuments(query),
      Animal.aggregate([
        { $match: { farm_id: new mongoose.Types.ObjectId(req.farm_id) } },
        { $group: { 
          _id: "$status", 
          count: { $sum: 1 } 
        }}
      ])
    ]);

    const statsObj = { total, safe: 0, warning: 0, danger: 0, offline: 0 };
    stats.forEach(s => {
      if (s._id) statsObj[s._id] = s.count;
    });

    return response.success(res, {
      animals,
      stats: statsObj,
      pagination: {
        total,
        page: parseInt(page),
        limit: limitInt,
        pages: Math.ceil(total / limitInt),
        hasMore: skip + animals.length < total
      }
    });
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
    const animal = await Animal.findOne({ _id: id, farm_id: req.farm_id });
    if (!animal) return response.error(res, 'Animal non trouvé.', 404, 'ANIMAL_NOT_FOUND');
    return response.success(res, animal);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals
 */
async function createAnimal(req, res, next) {
  try {
    const { name, type, breed, age, latitude, longitude, 
            weightKg, birthDate, rfidTag, deviceId, 
            colorHex, notes, avatarUrl, currentZoneId, current_zone_id } = req.body;

    if (deviceId && deviceId.trim()) {
      const existing = await Animal.findOne({ device_id: deviceId.trim() });
      if (existing) {
        return response.error(res, `Le collier ${deviceId} est déjà assigné à ${existing.name}.`, 409, 'DUPLICATE_DEVICE');
      }
    }

    if (rfidTag && rfidTag.trim()) {
      const existing = await Animal.findOne({ rfid_tag: rfidTag.trim() });
      if (existing) {
        return response.error(res, `Le tag RFID ${rfidTag} est déjà utilisé.`, 409, 'DUPLICATE_DEVICE');
      }
    }
    
    logger.info(`Creating animal "${name}" with coords: lat=${latitude}, lon=${longitude}`);

    let finalLat = parseFloat(latitude);
    let finalLon = parseFloat(longitude);
    const finalZoneId = currentZoneId || current_zone_id || null;

    if ((isNaN(finalLat) || finalLat === 0) && finalZoneId) {
      const zone = await Zone.findById(finalZoneId);
      if (zone) {
        finalLat = zone.center_lat || 0;
        finalLon = zone.center_lon || 0;
        logger.info(`[Fallback] Using zone "${zone.name}" center for animal "${name}"`);
      }
    }

    if (isNaN(finalLat)) finalLat = 0;
    if (isNaN(finalLon)) finalLon = 0;

    const animal = await Animal.create({
      user_id: req.user.id,
      farm_id: req.farm_id,
      name,
      type,
      breed,
      age: (age && !isNaN(parseInt(age))) ? parseInt(age) : 0,
      weight_kg: (weightKg && !isNaN(parseFloat(weightKg))) ? parseFloat(weightKg) : null,
      birth_date: birthDate,
      rfid_tag:  rfidTag  && rfidTag.trim()  ? rfidTag.trim()  : undefined,
      device_id: deviceId && deviceId.trim() ? deviceId.trim() : undefined,
      color_hex: colorHex || '#4CAF50',
      notes,
      avatar_url: avatarUrl,
      latitude:  finalLat,
      longitude: finalLon,
      current_zone_id: finalZoneId,
      status: 'safe',
      last_seen: new Date()
    });

    if (animal.device_id) {
      await Device.findOneAndUpdate(
        { device_id: animal.device_id },
        { status: 'assigned', assigned_to_animal_id: animal._id }
      );
    }
    
    return response.success(res, animal, 201);
  } catch (err) {
    if (err.code === 11000) {
      const conflictMsg = 'Ce device_id ou rfid_tag est déjà utilisé par un autre animal.';
      return response.error(res, conflictMsg, 400, 'DUPLICATE_DEVICE');
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
    
    if (updates.weightKg) { updates.weight_kg = updates.weightKg; delete updates.weightKg; }
    if (updates.birthDate) { updates.birth_date = updates.birthDate; delete updates.birthDate; }
    if (updates.rfidTag) { updates.rfid_tag = updates.rfidTag; delete updates.rfidTag; }
    if (updates.deviceId) { updates.device_id = updates.deviceId; delete updates.deviceId; }
    if (updates.colorHex) { updates.color_hex = updates.colorHex; delete updates.colorHex; }
    if (updates.avatarUrl) { updates.avatar_url = updates.avatarUrl; delete updates.avatarUrl; }
    if (updates.heartRate) { updates.heart_rate = updates.heartRate; delete updates.heartRate; }
    if (updates.batteryLevel) { updates.battery_level = updates.batteryLevel; delete updates.batteryLevel; }
    if (updates.signalStrength) { updates.signal_strength = updates.signalStrength; delete updates.signalStrength; }
    if (updates.currentZoneId) { updates.current_zone_id = updates.currentZoneId; delete updates.currentZoneId; }

    const existing = await Animal.findOne({ _id: id, farm_id: req.farm_id });
    if (!existing) return response.error(res, 'Animal non trouvé.', 404, 'ANIMAL_NOT_FOUND');

    logger.info(`Updating animal "${existing.name}": lat=${updates.latitude}, lon=${updates.longitude}`);

    const animal = await Animal.findOneAndUpdate(
      { _id: id, farm_id: req.farm_id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!animal) return response.error(res, 'Animal non trouvé.', 404, 'ANIMAL_NOT_FOUND');

    if (animal.current_zone_id) {
      zoneMonitorService.evaluateZone(animal.current_zone_id).catch(err => logger.error(`Zone evaluation failed: ${err.message}`));
    }
    if (existing.current_zone_id && String(existing.current_zone_id) !== String(animal.current_zone_id)) {
      zoneMonitorService.evaluateZone(existing.current_zone_id).catch(err => logger.error(`Old zone evaluation failed: ${err.message}`));
    }

    return response.success(res, animal);
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
    const animal = await Animal.findOne({ _id: id, farm_id: req.farm_id });
    if (!animal) return response.error(res, 'Animal non trouvé.', 404, 'ANIMAL_NOT_FOUND');

    if (animal.device_id) {
      await Device.findOneAndUpdate(
        { device_id: animal.device_id },
        { status: 'free', assigned_to_animal_id: null }
      );
    }

    await Animal.deleteOne({ _id: id });
    return response.success(res, { message: 'Animal deleted successfully and device released.' });
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
    const animal = await Animal.findOne({ _id: id, farm_id: req.farm_id });
    if (!animal || !animal.current_zone_id) return response.success(res, null);
    
    const zone = await Zone.findById(animal.current_zone_id);
    return response.success(res, zone);
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
      { _id: id, farm_id: req.farm_id },
      { $set: { current_zone_id: geofenceId } },
      { new: true }
    );
    
    if (!animal) return response.error(res, 'Animal non trouvé.', 404, 'ANIMAL_NOT_FOUND');
    return response.success(res, animal);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals/bulk
 */
async function bulkCreateAnimals(req, res, next) {
  try {
    const { animals } = req.body;
    const userId = req.user.id;
    const results = { imported: 0, skipped: 0, errors: [] };

    for (const data of animals) {
      try {
        await Animal.create({
          user_id: userId,
          farm_id: req.farm_id,
          name: data.name,
          type: data.type || 'other',
          rfid_tag: data.rfidTag || data.rfid_tag || null,
          device_id: data.deviceId || data.device_id || null,
          status: 'safe',
          last_seen: new Date()
        });
        results.imported++;
      } catch (err) {
        results.skipped++;
        results.errors.push({ name: data.name, error: err.message });
      }
    }

    return response.success(res, results);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals/:id/action
 * Triggers hardware actions (buzzer, LED, relay) via WebSocket.
 */
async function triggerAction(req, res, next) {
  try {
    const { id } = req.params;
    const { type, state } = req.body;

    const animal = await Animal.findOne({ _id: id, farm_id: req.farm_id });
    if (!animal) return response.error(res, 'Animal non trouvé.', 404, 'ANIMAL_NOT_FOUND');

    if (animal.actuators) {
      animal.actuators[type] = state;
      animal.markModified('actuators');
      await animal.save();
    }

    const io = socketConfig.getIO();
    io.to(`animal:${id}`).emit('hardware-command', { 
      animalId: id,
      type, 
      state 
    });

    return response.success(res, animal);
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
  bulkCreateAnimals,
  triggerAction
};
