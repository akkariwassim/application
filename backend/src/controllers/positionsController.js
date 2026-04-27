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
      { _id: animalId, farm_id: req.farm_id },
      { $set: updatePayload },
      { new: true }
    );
    
    if (!animal) return res.status(404).json({ 
      success: false,
      error: 'ANIMAL_NOT_FOUND',
      message: 'Animal non trouvé.' 
    });

    // 2. Log Historical Data (Movement & Health)
    const statsService = require('../services/statsService');
    statsService.logMetrics(animal, {
      latitude, longitude, temperature, heart_rate, activity, battery_level, gps_signal
    }).catch(err => logger.error(`Stats logging failed: ${err.message}`));

    // 2b. Trigger AI Prediction (Asynchronous)
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

    // 4. Geofence & Alert Monitoring
    try {
      const { processZoneMonitoring } = require('../services/alertService');
      await processZoneMonitoring(animal, { latitude, longitude });
    } catch (alertErr) {
      logger.error(`Alert monitoring failed for animal ${animalId}: ${alertErr.message}`);
      
      // Fallback geofence logic if alertService fails
      try {
        const activeZone = await Zone.findByAnimal(animalId, req.user.id);
        if (activeZone && activeZone.is_active) {
          let coords = [];
          if (activeZone.type === 'polygon' && activeZone.polygon_coords) {
            coords = typeof activeZone.polygon_coords === 'string' 
              ? JSON.parse(activeZone.polygon_coords) 
              : activeZone.polygon_coords;
          }

          const isInside = geofenceService.checkInside(
            { lat: latitude, lng: longitude },
            activeZone.type,
            activeZone.radius,
            coords,
            activeZone.location ? activeZone.location.coordinates : null
          );

          if (!isInside) {
            await Alert.create({
              animal_id: animalId,
              user_id: req.user.id,
              farm_id: req.farm_id,
              type: 'exit',
              zone_id: activeZone._id,
              message: `L'animal ${animal.name} a quitté sa zone "${activeZone.name}"!`
            });
            socketConfig.emitAlert(req.farm_id, animalId, {
              type: 'exit',
              animalId,
              animalName: animal.name,
              message: `Alerte: ${animal.name} hors zone!`
            });
          }
        }
      } catch (gErr) {
        logger.error(`Fallback geofence evaluation failed: ${gErr.message}`);
      }
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
    const { days = 1 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const MovementHistory = require('../models/MovementHistory');
    const history = await MovementHistory.find({ 
      animal_id: animalId, 
      farm_id: req.farm_id,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });
    
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
      farm_id: req.farm_id 
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
