'use strict';

const Position       = require('../models/Position');
const Animal         = require('../models/Animal');
const Geofence       = require('../models/Geofence');
const { checkBreach }         = require('../services/geofenceService');
const { createGeofenceAlert, createHealthAlert, markAnimalSafe } = require('../services/alertService');
const { emitPositionUpdate }  = require('../config/socket');
const logger         = require('../utils/logger');

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
      animal = await Animal.findById(bodyAnimalId, req.user?.id || 0);
    }
    if (!animal && deviceId) {
      animal = await Animal.findByDeviceId(deviceId);
    }
    if (!animal) {
      return res.status(404).json({ error: 'Animal not found for this device' });
    }

    const animalId = animal.id;
    const userId   = animal.user_id;

    // Save position
    const positionId = await Position.create({
      animalId,
      latitude:  parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracyM:  accuracy  != null ? parseFloat(accuracy)  : null,
      altitudeM:  altitude  != null ? parseFloat(altitude)  : null,
      speedMps:   speed     != null ? parseFloat(speed)     : null,
      headingDeg: heading   != null ? parseFloat(heading)   : null,
      satellites: satellites != null ? parseInt(satellites)  : null,
      hdop:       hdop      != null ? parseFloat(hdop)      : null,
      temperatureC: temperature != null ? parseFloat(temperature) : null,
      activityScore: activity    != null ? parseFloat(activity)    : null,
      deviceId:   deviceId  || animal.device_id,
      recordedAt: timestamp ? new Date(timestamp) : new Date()
    });

    // Emit position update via WebSocket
    emitPositionUpdate(animalId, { 
      latitude, longitude, speed, satellites, 
      temperature, activity,
      timestamp: new Date().toISOString() 
    });

    // --- Geofence check ---
    const geofence = await Geofence.findByAnimal(animalId, userId);
    let alertResult = null;

    if (geofence) {
      const { breached, distanceM } = checkBreach(
        parseFloat(latitude), parseFloat(longitude), geofence
      );

      if (breached) {
        alertResult = await createGeofenceAlert({
          animalId, userId,
          latitude,  longitude,
          distanceM, radiusM: geofence.radius_m
        });
      } else {
        await markAnimalSafe(animalId, userId);
      }
    }

    // --- Health checks ---
    if (temperature != null) {
      const t = parseFloat(temperature);
      if (t > animal.max_temp) {
        await createHealthAlert({
          animalId, userId, type: 'temperature', severity: 'critical',
          message: `High temperature detected: ${t}°C (Threshold: ${animal.max_temp}°C)`,
          latitude, longitude
        });
      } else if (t < animal.min_temp) {
        await createHealthAlert({
          animalId, userId, type: 'temperature', severity: 'warning',
          message: `Low temperature detected: ${t}°C (Threshold: ${animal.min_temp}°C)`,
          latitude, longitude
        });
      }
    }

    if (activity != null) {
      const a = parseFloat(activity);
      if (a < animal.min_activity) {
        await createHealthAlert({
          animalId, userId, type: 'activity', severity: 'warning',
          message: `Low activity level: ${a}% (Threshold: ${animal.min_activity}%)`,
          latitude, longitude
        });
      } else if (a > animal.max_activity) {
        await createHealthAlert({
          animalId, userId, type: 'activity', severity: 'critical',
          message: `Abnormal high activity: ${a}% (Threshold: ${animal.max_activity}%)`,
          latitude, longitude
        });
      }
    }

    res.status(201).json({
      positionId,
      animalId,
      alert: alertResult
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
    const { from, to, limit } = req.query;

    // Verify ownership
    const animal = await Animal.findById(animalId, req.user.id);
    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    const positions = await Position.findHistory(animalId, { from, to, limit });
    res.json(positions);
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

    const animal = await Animal.findById(animalId, req.user.id);
    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    const position = await Position.findLatest(animalId);
    if (!position) return res.status(404).json({ error: 'No position data yet' });
    res.json(position);
  } catch (err) {
    next(err);
  }
}

module.exports = { submitPosition, getHistory, getLatest };
