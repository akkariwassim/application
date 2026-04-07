'use strict';

const Alert   = require('../models/Alert');
const Animal  = require('../models/Animal');
const Zone    = require('../models/Zone');
const { emitAlert, emitStatusChange } = require('../config/socket');
const winston = require('winston');
const { checkBreach } = require('./geofenceService');

/**
 * Alert Service
 * Handles alert creation, deduplication, and real-time notifications.
 */

/**
 * Create a geofence breach alert.
 */
async function createGeofenceAlert({ animalId, userId, latitude, longitude, distanceM, radiusM, zoneId, zoneName }) {
  try {
    // Deduplication: check if an active geofence alert exists in the last 15 mins
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recent = await Alert.findOne({
      animalId,
      type: 'geofence_exit',
      status: 'active',
      createdAt: { $gt: fifteenMinsAgo }
    });

    if (recent) return null;

    const zoneLabel = zoneName ? `la zone "${zoneName}"` : "la zone de sécurité";
    const message = radiusM 
      ? `L'animal a quitté ${zoneLabel} ! Distance : ${Math.round(distanceM || 0)}m (rayon : ${radiusM}m).`
      : `L'animal a quitté ${zoneLabel} (clôture polygonale).`;

    const alert = await Alert.create({
      animalId,
      userId,
      zoneId,
      type:      'geofence_exit',
      severity:  'critical',
      message,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    });

    // Update animal status
    await Animal.findByIdAndUpdate(animalId, { $set: { status: 'out_of_zone' } });

    const alertPayload = {
      id: alert._id,
      animalId,
      type: alert.type,
      severity: alert.severity,
      message,
      location: alert.location,
      createdAt: alert.createdAt
    };

    emitAlert(userId, animalId, alertPayload);
    emitStatusChange(userId, animalId, 'out_of_zone');

    winston.warn(`🚨 Geofence breach — animal ${animalId}: ${message}`);
    return alert;
  } catch (err) {
    winston.error('Failed to create geofence alert:', err.message);
    throw err;
  }
}

/**
 * Create a health-related alert (temperature or activity).
 */
async function createHealthAlert({ animalId, userId, type, severity, message, latitude, longitude }) {
  try {
    // Deduplication: check if similar active alert exists in the last 30 mins
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recent = await Alert.findOne({
      animalId,
      type,
      status: 'active',
      createdAt: { $gt: thirtyMinsAgo }
    });

    if (recent) return null;

    const alert = await Alert.create({
      animalId,
      userId,
      type,
      severity,
      message,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    });

    // Update animal status if critical
    if (severity === 'critical') {
      await Animal.findByIdAndUpdate(animalId, { $set: { status: 'warning' } });
      emitStatusChange(userId, animalId, 'warning');
    }

    const alertPayload = {
      id: alert._id,
      animalId,
      type,
      severity,
      message,
      location: alert.location,
      createdAt: alert.createdAt
    };

    emitAlert(userId, animalId, alertPayload);
    winston.warn(`🩺 Health alert — animal ${animalId} (${type}): ${message}`);
    return alert;
  } catch (err) {
    winston.error('Failed to create health alert:', err.message);
    throw err;
  }
}

/**
 * Mark an animal as safe and resolve any active breach alerts.
 */
async function markAnimalSafe(animalId, userId) {
  await Animal.findByIdAndUpdate(animalId, { $set: { status: 'healthy' } });
  emitStatusChange(userId, animalId, 'healthy');
}

/**
 * Enhanced Zone Monitoring
 * Checks all user zones for transitions and breaches via Mongoose.
 */
async function processZoneMonitoring(animal, currentPos) {
  const { _id: animalId, userId, currentZoneId: lastZoneId } = animal;
  const { latitude, longitude } = currentPos;

  try {
    // 1. Fetch all zones for this user
    const zones = await Zone.find({ userId, isActive: true }).sort({ priorityLevel: -1 });
    let matchedZone = null;

    // 2. Find which zone the animal is currently in
    for (const zone of zones) {
      const { breached } = checkBreach(latitude, longitude, zone);
      if (!breached) { // !breached means INSIDE
        matchedZone = zone;
        break; 
      }
    }

    const matchedId = matchedZone ? matchedZone._id : null;

    // 3. Handle Transitions (Entry/Exit)
    if (String(matchedId) !== String(lastZoneId)) {
      if (lastZoneId) {
        winston.info(`🚶 Animal ${animalId} exited zone ${lastZoneId}`);
      }
      if (matchedId) {
        winston.info(`🚩 Animal ${animalId} entered zone ${matchedId} (${matchedZone.name})`);
      }
      await Animal.findByIdAndUpdate(animalId, { $set: { currentZoneId: matchedId } });
    }

    // 4. Breach Detection for assigned primary zone
    // If there is a currentZoneId assigned to animal, check it specifically
    if (animal.currentZoneId) {
      const primaryZone = await Zone.findById(animal.currentZoneId);
      if (primaryZone) {
        const { breached, distanceM } = checkBreach(latitude, longitude, primaryZone);
        if (breached) {
          await createGeofenceAlert({
            animalId, userId, 
            latitude, longitude,
            distanceM, radiusM: primaryZone.radiusM,
            zoneId: primaryZone._id,
            zoneName: primaryZone.name
          });
        } else if (animal.status === 'out_of_zone' || animal.status === 'warning') {
          await markAnimalSafe(animalId, userId);
        }
      }
    }

    return matchedZone;
  } catch (err) {
    winston.error(`Error in processZoneMonitoring for animal ${animalId}:`, err.message);
  }
}

module.exports = {
  createGeofenceAlert,
  createHealthAlert,
  markAnimalSafe,
  processZoneMonitoring
};
