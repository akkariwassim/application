'use strict';

const Animal          = require('../models/Animal');
const SensorData      = require('../models/SensorData');
const Zone            = require('../models/Zone');
const Alert           = require('../models/Alert');
const monitorService  = require('../services/monitorService');
const socketConfig    = require('../config/socket');
const logger          = require('../utils/logger');

/**
 * Update animal position /api/positions
 * Expects { animalId, latitude, longitude, temperature, activity }
 */
async function submitPosition(req, res, next) {
  try {
    const { 
      animalId, latitude, longitude, 
      temperature, heart_rate, battery_level, gps_signal, activity 
    } = req.body;
    
    // 1. Update the Animal with latest metrics (ONLY provided fields)
    const updatePayload = { 
      last_seen: new Date(),
      last_sync: new Date()
    };
    
    if (latitude !== undefined)  updatePayload.latitude  = latitude;
    if (longitude !== undefined) updatePayload.longitude = longitude;
    if (temperature !== undefined) updatePayload.temperature = temperature;
    if (heart_rate !== undefined)   updatePayload.heart_rate   = heart_rate;
    if (battery_level !== undefined) updatePayload.battery_level = battery_level;
    if (gps_signal !== undefined)    updatePayload.gps_signal    = gps_signal;
    if (activity !== undefined)      updatePayload.activity      = activity;

    const animal = await Animal.findOneAndUpdate(
      { _id: animalId, user_id: req.user.id },
      { $set: updatePayload },
      { new: true }
    );
    
    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    // 2. Save to SensorData (History)
    await SensorData.create({
      animal_id: animalId,
      user_id: req.user.id,
      latitude:      animal.latitude,
      longitude:     animal.longitude,
      temperature:   animal.temperature,
      heart_rate:    animal.heart_rate,
      battery_level: animal.battery_level,
      gps_signal:    animal.gps_signal,
      activity:      animal.activity,
      timestamp:     animal.last_sync
    });
    
    // 3. Broadcast real-time update via WebSocket (Always, for live UI)
    socketConfig.emitPositionUpdate(req.user.id, animalId, { 
      latitude:      animal.latitude, 
      longitude:     animal.longitude, 
      temperature:   animal.temperature, 
      heart_rate:    animal.heart_rate,
      battery_level: animal.battery_level,
      gps_signal:    animal.gps_signal,
      activity:      animal.activity,
      timestamp:     animal.last_sync
    });

    // 4. Persistence Throttling: Save to history only if threshold met
    const shouldSave = monitorService.shouldPersist(
      animal.last_sync_history, // We'll add this field or just use a helper
      { latitude: animal.last_lat_history, longitude: animal.last_lon_history },
      { latitude, longitude }
    );

    if (shouldSave) {
      await SensorData.create({
        animal_id: animalId,
        user_id: req.user.id,
        latitude,
        longitude,
        temperature: animal.temperature,
        heart_rate:  animal.heart_rate,
        activity:    animal.activity,
        timestamp:   animal.last_sync
      });
      
      // Update tracking state for next throttling check
      animal.last_sync_history = new Date();
      animal.last_lat_history  = latitude;
      animal.last_lon_history  = longitude;
    }

    // 5. Intelligent Monitoring (Async - don't block response)
    // We run this in background to keep API response < 100ms
    setImmediate(async () => {
      try {
        const newStatus = await monitorService.checkGeofence(animal, latitude, longitude);
        if (newStatus !== animal.status) {
          animal.status = newStatus;
        }
        await monitorService.checkVitals(animal, { 
          temperature, heart_rate, battery_level, gps_signal 
        }, { latitude, longitude });
        
        await animal.save();
      } catch (err) {
        logger.error(`[PositionsController] Background Monitor Error: ${err.message}`);
      }
    });

    res.json({ message: 'Position received and processed', status: animal.status });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/positions/:animalId/history
 */
async function getHistory(req, res, next) {
  try {
    const { animalId } = req.params;
    const history = await SensorData.find({ 
      animal_id: animalId, 
      user_id: req.user.id 
    }).sort({ timestamp: -1 }).limit(100);
    
    res.json(history);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/positions/:animalId/latest
 */
async function getLatest(req, res, next) {
  try {
    const { animalId } = req.params;
    const latest = await SensorData.findOne({ 
      animal_id: animalId, 
      user_id: req.user.id 
    }).sort({ timestamp: -1 });
    
    if (!latest) return res.status(404).json({ error: 'No history found' });
    res.json(latest);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitPosition,
  getHistory,
  getLatest
};
