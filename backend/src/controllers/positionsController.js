'use strict';

const Animal     = require('../models/Animal');
const Zone       = require('../models/Zone');
const SensorData = require('../models/SensorData');
const { processZoneMonitoring, createHealthAlert, markAnimalSafe } = require('../services/alertService');
const { emitPositionUpdate } = require('../config/socket');
const winston = require('winston');

/**
 * POST /api/positions
 * Accepts GPS data from ESP32 firmware.
 * Performs geofence check and emits real-time events.
 */
async function submitPosition(req, res, next) {
  try {
    const {
      deviceId, animalId: bodyAnimalId,
      latitude, longitude,
      accuracy, speed, altitude, heading,
      timestamp, satellites, hdop,
      temperature, activity
    } = req.body;

    // Resolve animal
    let animal = null;
    if (bodyAnimalId) {
      animal = await Animal.findById(bodyAnimalId);
    }
    if (!animal && deviceId) {
      animal = await Animal.findOne({ deviceId });
    }
    if (!animal) {
      return res.status(404).json({ error: 'Animal not found for this device' });
    }

    const animalId = animal._id;
    const userId   = animal.userId;

    // Save SensorData (Time-Series)
    const sensorEntry = await SensorData.create({
      animalId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      metrics: {
        temperature: temperature != null ? parseFloat(temperature) : 0,
        activity: activity != null ? parseFloat(activity) : 0,
        battery: req.body.battery != null ? parseFloat(req.body.battery) : null,
        speedMps: speed != null ? parseFloat(speed) : null
      },
      metadata: {
        deviceId: deviceId || animal.deviceId,
        signalStrength: req.body.rssi
      }
    });

    // Update animal's current location and last seen
    await Animal.findByIdAndUpdate(animalId, {
      $set: {
        currentLocation: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        lastSeen: new Date()
      }
    });

    // Emit position update via WebSocket
    emitPositionUpdate(animalId, { 
      latitude, longitude, speed, satellites, 
      temperature, activity,
      timestamp: new Date().toISOString() 
    });

    // --- Advanced Zone Monitoring (Entry/Exit, Breaches) ---
    const monitorResult = await processZoneMonitoring(animal, { latitude, longitude });

    // --- Health checks ---
    if (temperature != null) {
      const t = parseFloat(temperature);
      if (t > animal.settings.maxTemp) {
        await createHealthAlert({
          animalId, userId, type: 'high_temp', severity: 'critical',
          message: `Temperature élevée détectée: ${t}°C (Seuil: ${animal.settings.maxTemp}°C)`,
          latitude, longitude
        });
      } else if (t < animal.settings.minTemp) {
        await createHealthAlert({
          animalId, userId, type: 'low_temp', severity: 'warning',
          message: `Temperature basse détectée: ${t}°C (Seuil: ${animal.settings.minTemp}°C)`,
          latitude, longitude
        });
      }
    }

    if (activity != null) {
      const a = parseFloat(activity);
      if (a < animal.settings.minActivity) {
        await createHealthAlert({
          animalId, userId, type: 'low_activity', severity: 'warning',
          message: `Niveau d'activité faible: ${a}% (Seuil: ${animal.settings.minActivity}%)`,
          latitude, longitude
        });
      } else if (a > animal.settings.maxActivity) {
        await createHealthAlert({
          animalId, userId, type: 'high_activity', severity: 'critical',
          message: `Activité anormale élevée: ${a}% (Seuil: ${animal.settings.maxActivity}%)`,
          latitude, longitude
        });
      }
    }

    res.status(201).json({
      sensorDataId: sensorEntry._id,
      animalId,
      status: animal.status
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/positions/:animalId
 */
async function getHistory(req, res, next) {
  try {
    const { animalId } = req.params;
    const { from, to, limit = 100 } = req.query;

    // Verify ownership
    const animal = await Animal.findOne({ _id: animalId, userId: req.user.id });
    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    const query = { animalId };
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const history = await SensorData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

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

    const animal = await Animal.findOne({ _id: animalId, userId: req.user.id });
    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    const latest = await SensorData.findOne({ animalId }).sort({ timestamp: -1 });
    if (!latest) return res.status(404).json({ error: 'No position data yet' });
    
    res.json(latest);
  } catch (err) {
    next(err);
  }
}

module.exports = { submitPosition, getHistory, getLatest };
