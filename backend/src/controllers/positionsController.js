'use strict';

const Animal          = require('../models/Animal');
const SensorData      = require('../models/SensorData');
const Geofence        = require('../models/Geofence');
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
    const { animalId, latitude, longitude, temperature, activity } = req.body;
    
    // 1. Update the Animal with latest metrics
    const animal = await Animal.findOneAndUpdate(
      { _id: animalId, user_id: req.user.id },
      { 
        $set: { 
          latitude, 
          longitude, 
          temperature: temperature || 38.5, 
          activity: activity || 50,
          last_seen: new Date()
        } 
      },
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
      temperature: temperature || 38.5,
      activity: activity || 50,
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
      activity: animal.activity,
      timestamp: animal.last_seen
    });

    // 4. Geofence Check & Alerting
    try {
      const activeZone = await Geofence.findByAnimal(animalId, req.user.id);
      if (activeZone && activeZone.is_active) {
        let coords = [];
        if (activeZone.type === 'polygon' && activeZone.polygon_coords) {
          coords = typeof activeZone.polygon_coords === 'string' 
            ? JSON.parse(activeZone.polygon_coords) 
            : activeZone.polygon_coords;
        }

        const checkResult = geofenceService.checkBreach(latitude, longitude, {
          type: activeZone.type,
          radiusM: activeZone.radius_m,
          center: { coordinates: [activeZone.center_lon, activeZone.center_lat] },
          geometry: activeZone.type === 'polygon' ? { 
            type: 'Polygon', 
            coordinates: [coords.map(c => [c.longitude, c.latitude])] 
          } : null,
          isActive: true
        });

        if (checkResult.breached) {
          logger.warn(`Geofence Breach! Animal ${animalId} left zone ${activeZone.name}`);
          
          // Create Alert in DB
          const alert = await Alert.create({
            animal_id: animalId,
            user_id: req.user.id,
            geofence_id: activeZone.id,
            type: 'exit',
            severity: 'danger',
            message: `⚠️ L'animal ${animal.name} a quitté sa zone : ${activeZone.name}`,
            location: { type: 'Point', coordinates: [longitude, latitude] }
          });

          // Update animal status
          animal.status = 'danger';
          await animal.save();

          // Push alert via Socket
          socketConfig.emitAlert(req.user.id, animalId, alert);
          socketConfig.emitStatusChange(req.user.id, animalId, 'danger');
        } else if (animal.status !== 'safe') {
          // Recover if back in zone
          animal.status = 'safe';
          await animal.save();
          socketConfig.emitStatusChange(req.user.id, animalId, 'safe');
        }
      }
    } catch (geoErr) {
      logger.error(`Geofence calculation error: ${geoErr.message}`);
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
