'use strict';

const Alert   = require('../models/Alert');
const Animal  = require('../models/Animal');
const Zone    = require('../models/Zone');
const { emitAlert, emitStatusChange } = require('../config/socket');
const logger = require('../utils/logger');
const { checkBreach } = require('./geofenceService');
const zoneMonitorService = require('./zoneMonitorService');

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
      animal_id: animalId,
      type: 'geofence_exit',
      status: 'active',
      created_at: { $gt: fifteenMinsAgo }
    });

    if (recent) return null;

    const zoneLabel = zoneName ? `la zone "${zoneName}"` : "la zone de sécurité";
    const message = radiusM 
      ? `L'animal a quitté ${zoneLabel} ! Distance : ${Math.round(distanceM || 0)}m (rayon : ${radiusM}m).`
      : `L'animal a quitté ${zoneLabel} (clôture polygonale).`;

    const alert = await Alert.create({
      animal_id: animalId,
      user_id: userId,
      zone_id: zoneId,
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

    logger.warn(`🚨 Geofence breach — animal ${animalId}: ${message}`);
    
    // Trigger zone evaluation
    if (zoneId) {
      zoneMonitorService.evaluateZone(zoneId).catch(err => logger.error(`Zone evaluation failed: ${err.message}`));
    }
    
    return alert;
  } catch (err) {
    logger.error('Failed to create geofence alert:', err.message);
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
      animal_id: animalId,
      type,
      status: 'active',
      created_at: { $gt: thirtyMinsAgo }
    });

    if (recent) return null;

    const alert = await Alert.create({
      animal_id: animalId,
      user_id: userId,
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
    logger.warn(`🩺 Health alert — animal ${animalId} (${type}): ${message}`);

    // Trigger zone evaluation for the animal's zone
    const animal = await Animal.findById(animalId);
    if (animal && animal.current_zone_id) {
      zoneMonitorService.evaluateZone(animal.current_zone_id).catch(err => logger.error(`Zone evaluation failed: ${err.message}`));
    }

    return alert;
  } catch (err) {
    logger.error('Failed to create health alert:', err.message);
    throw err;
  }
}

/**
 * Mark an animal as safe and resolve any active breach alerts.
 */
async function markAnimalSafe(animalId, userId) {
  const animal = await Animal.findByIdAndUpdate(animalId, { $set: { status: 'healthy' } }, { new: true });
  emitStatusChange(userId, animalId, 'healthy');

  // Trigger zone evaluation
  if (animal && animal.current_zone_id) {
    zoneMonitorService.evaluateZone(animal.current_zone_id).catch(err => logger.error(`Zone evaluation failed: ${err.message}`));
  }
}

/**
 * Enhanced Zone Monitoring
 * Checks all user zones for transitions and breaches via Mongoose.
 */
async function processZoneMonitoring(animal, currentPos) {
  const { _id: animalId, user_id: userId, current_zone_id: assignedZoneId } = animal;
  const { latitude, longitude } = currentPos;

  try {
    // 1. Fetch all zones for this user to find current position
    const allZones = await Zone.find({ user_id: userId, is_active: true });
    let matchedZone = null;

    for (const zone of allZones) {
      const { breached } = checkBreach(latitude, longitude, zone);
      if (!breached) { 
        matchedZone = zone;
        break; 
      }
    }

    const matchedId = matchedZone ? matchedZone._id : null;

    // 2. Handle Entry/Exit logging (Non-destructive to assignedZoneId)
    // We can use a separate field or just log it for now
    if (matchedId && String(matchedId) !== String(assignedZoneId)) {
       // Optional: Log crossing into a different zone
    }

    // 3. Mandatory Breach Detection for the ASSIGNED zone
    if (assignedZoneId) {
      const primaryZone = await Zone.findById(assignedZoneId);
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
          // Animal returned to its assigned zone
          await markAnimalSafe(animalId, userId);
        }
      }
    }

    return matchedZone;
  } catch (err) {
    logger.error(`Error in processZoneMonitoring for animal ${animalId}:`, err.message);
  }
}

module.exports = {
  createGeofenceAlert,
  createHealthAlert,
  markAnimalSafe,
  processZoneMonitoring
};
