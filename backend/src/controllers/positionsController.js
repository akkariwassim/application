'use strict';

const Animal          = require('../models/Animal');
const SensorData      = require('../models/SensorData');
const Zone            = require('../models/Zone');
const Alert           = require('../models/Alert');
const geofenceService = require('../services/geofenceService');
const aiService       = require('../services/aiService');
const socketConfig    = require('../config/socket');
const logger          = require('../utils/logger');
const response        = require('../utils/responseHelper');

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
    
    // 1. Update the Animal with latest metrics
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
      { _id: animalId, farm_id: req.farm_id },
      { $set: updatePayload },
      { new: true }
    );
    
    if (!animal) return response.error(res, 'Animal non trouvé.', 404, 'ANIMAL_NOT_FOUND');

    // 2. Log Historical Data (Movement & Health) - Background
    const statsService = require('../services/statsService');
    statsService.logMetrics(animal, {
      latitude, longitude, temperature, heart_rate, activity, battery_level, gps_signal
    }).catch(err => logger.error(`Stats logging failed: ${err.message}`));

    // 2b. Trigger AI Prediction (Asynchronous) - Background
    aiService.processAIPrediction(animal, { 
      latitude, longitude, temperature, heart_rate, activity 
    }).catch(err => {
      logger.error(`Async AI processing failed: ${err.message}`);
    });
    
    // 3. Broadcast update via WebSocket
    socketConfig.emitPositionUpdate(req.farm_id, animalId, { 
      latitude, 
      longitude, 
      temperature: animal.temperature, 
      heart_rate: animal.heart_rate,
      battery_level: animal.battery_level,
      signal_strength: animal.signal_strength,
      activity: animal.activity,
      timestamp: animal.last_seen
    });

    // 4. Geofence & Alert Monitoring - Try to process synchronously for immediate safety
    try {
      const { processZoneMonitoring } = require('../services/alertService');
      await processZoneMonitoring(animal, { latitude, longitude });
    } catch (alertErr) {
      logger.error(`Alert monitoring failed for animal ${animalId}: ${alertErr.message}`);
    }

    return response.success(res, { message: 'Position mise à jour.', animal });
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
    const { days = 1 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const MovementHistory = require('../models/MovementHistory');
    const history = await MovementHistory.find({ 
      animal_id: animalId, 
      farm_id: req.farm_id,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });
    
    return response.success(res, history);
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
      farm_id: req.farm_id 
    }).sort({ timestamp: -1 });
    
    if (!latest) return response.error(res, 'Aucun historique trouvé.', 404, 'NO_HISTORY');
    return response.success(res, latest);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitPosition,
  getHistory,
  getLatest
};
