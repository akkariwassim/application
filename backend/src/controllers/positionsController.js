'use strict';

const Animal          = require('../models/Animal');
const SensorData      = require('../models/SensorData');
const Zone            = require('../models/Zone');
const Alert           = require('../models/Alert');
const geofenceService = require('../services/geofenceService');
const aiService       = require('../services/aiService');
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
    if (heart_rate !== undefined)     updatePayload.heart_rate     = heart_rate;
    if (battery_level !== undefined)  updatePayload.battery_level  = battery_level;
    if (gps_signal !== undefined)     updatePayload.signal_strength = gps_signal;
    if (activity !== undefined)       updatePayload.activity       = activity;

    const animal = await Animal.findOneAndUpdate(
      { _id: animalId, user_id: req.user.id },
      { $set: updatePayload },
      { new: true }
    );
    
    if (!animal) return res.status(404).json({ 
      success: false,
      error: 'ANIMAL_NOT_FOUND',
      message: 'Animal non trouvé.' 
    });

    // 2. Save Historical SensorData
    const sensorData = await SensorData.create({
      animal_id: animalId,
      user_id: req.user.id,
      latitude,
      longitude,
      temperature: temperature || animal.temperature || 38.5,
      heart_rate: heart_rate || animal.heart_rate,
      battery_level: battery_level || animal.battery_level,
      gps_signal: gps_signal || animal.signal_strength,
      activity: activity || animal.activity || 50,
      timestamp: new Date()
    });

    // 2b. Trigger AI Prediction (Asynchronous)
    aiService.processAIPrediction(animal, sensorData).catch(err => {
      logger.error(`Async AI processing failed: ${err.message}`);
    });
    
    // 3. Broadcast update via WebSocket
    socketConfig.emitPositionUpdate(req.user.id, animalId, { 
      latitude, 
      longitude, 
      temperature: animal.temperature, 
      heart_rate: animal.heart_rate,
      battery_level: animal.battery_level,
      signal_strength: animal.signal_strength,
      activity: animal.activity,
      timestamp: animal.last_seen
    });

    // 4. Geofence & Alert Monitoring
    try {
      const { processZoneMonitoring } = require('../services/alertService');
      await processZoneMonitoring(animal, { latitude, longitude });
    } catch (alertErr) {
      logger.error(`Alert monitoring failed for animal ${animalId}: ${alertErr.message}`);
    }

    res.json({ success: true, data: { message: 'Position mise à jour.', animal } });
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
    
    res.json({ success: true, data: history });
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
    
    if (!latest) return res.status(404).json({ 
      success: false,
      error: 'NO_HISTORY',
      message: 'Aucun historique trouvé.' 
    });
    res.json({ success: true, data: latest });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitPosition,
  getHistory,
  getLatest
};
