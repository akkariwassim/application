'use strict';

const Alert   = require('../models/Alert');
const Animal  = require('../models/Animal');
const { pool } = require('../config/database');
const { emitAlert, emitStatusChange } = require('../config/socket');
const logger  = require('../utils/logger');
const Geofence = require('../models/Geofence');
const { isPointInPolygon } = require('../utils/geoUtils');

/**
 * Alert Service
 * Handles alert creation, deduplication, and real-time notifications.
 */

async function createGeofenceAlert({ animalId, userId, latitude, longitude, distanceM, radiusM, geofenceId, geofenceName }) {
  try {
    // Deduplication: check if an active geofence alert exists in the last 15 mins
    const [recent] = await pool.query(
      "SELECT id FROM alerts WHERE animal_id = ? AND type = 'geofence_breach' AND created_at > NOW() - INTERVAL 15 MINUTE LIMIT 1",
      [animalId]
    );
    if (recent.length > 0) return null;

    const zoneLabel = geofenceName ? `la zone "${geofenceName}"` : "la zone de sécurité";
    const message = radiusM 
      ? `L'animal a quitté ${zoneLabel} ! Distance : ${Math.round(distanceM || 0)}m (rayon : ${radiusM}m).`
      : `L'animal a quitté ${zoneLabel} (clôture polygonale).`;

    const alertId = await Alert.create({
      animalId,
      userId,
      type:      'geofence_breach',
      severity:  'critical',
      message,
      latitude,
      longitude,
      geofenceId: geofenceId
    });

    await Animal.updateStatus(animalId, 'danger');

    const alertPayload = {
      id: alertId,
      animalId,
      type: 'geofence_breach',
      severity: 'critical',
      message,
      latitude,
      longitude,
      createdAt: new Date().toISOString()
    };

    emitAlert(userId, animalId, alertPayload);
    emitStatusChange(userId, animalId, 'danger');

    logger.warn(`🚨 Geofence breach — animal ${animalId}: ${message}`);
    return { alertId, ...alertPayload };
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
    const [recent] = await pool.query(
      "SELECT id FROM alerts WHERE animal_id = ? AND type = ? AND created_at > NOW() - INTERVAL 30 MINUTE LIMIT 1",
      [animalId, type]
    );
    if (recent.length > 0) return null;

    const alertId = await Alert.create({
      animalId, userId, type, severity, message, latitude, longitude
    });

    // Update animal status if critical
    if (severity === 'critical') {
      await Animal.updateStatus(animalId, 'warning');
      emitStatusChange(userId, animalId, 'warning');
    }

    const alertPayload = {
      id: alertId,
      animalId,
      type,
      severity,
      message,
      latitude,
      longitude,
      createdAt: new Date().toISOString()
    };

    emitAlert(userId, animalId, alertPayload);
    logger.warn(`🩺 Health alert — animal ${animalId} (${type}): ${message}`);
    return { alertId, ...alertPayload };
  } catch (err) {
    logger.error('Failed to create health alert:', err.message);
    throw err;
  }
}

/**
 * Mark an animal as safe and resolve any active breach alerts.
 */
async function markAnimalSafe(animalId, userId) {
  await Animal.updateStatus(animalId, 'safe');
  emitStatusChange(userId, animalId, 'safe');
}

/**
 * Enhanced Geofence & Zone Monitoring
 * Checks all user zones for transitions and breaches.
 */
async function processZoneMonitoring(animal, currentPos) {
  const { id: animalId, user_id: userId, current_zone_id: lastZoneId } = animal;
  const { latitude, longitude } = currentPos;
  const point = { latitude, longitude };

  try {
    // 1. Fetch all zones for this user
    const zones = await Geofence.findByUser(userId);
    let matchedZone = null;

    // 2. Find which zone the animal is currently in
    for (const zone of zones) {
      if (zone.type === 'polygon' && zone.polygon_coords) {
        const coords = typeof zone.polygon_coords === 'string' ? JSON.parse(zone.polygon_coords) : zone.polygon_coords;
        if (isPointInPolygon(point, coords)) {
          matchedZone = zone;
          break; // Stop at the first highest-priority zone found (due to sorting in findByUser)
        }
      }
    }

    const matchedId = matchedZone ? matchedZone.id : null;

    // 3. Handle Transitions (Entry/Exit)
    if (matchedId !== lastZoneId) {
      if (lastZoneId) {
        await Geofence.logEvent(lastZoneId, animalId, 'exit');
        logger.info(`🚶 Animal ${animalId} exited zone ${lastZoneId}`);
      }
      if (matchedId) {
        await Geofence.logEvent(matchedId, animalId, 'enter');
        logger.info(`🚩 Animal ${animalId} entered zone ${matchedId} (${matchedZone.name})`);
      }
      await Animal.updateCurrentZone(animalId, matchedId);
    }

    // 4. Breach Detection for "Animal-Specific" Active Geofence
    // Or if the animal is NOT in any grazing zone and it's supposed to be.
    // If there's an active primary zone, the animal SHOULD be in it or another grazing zone.
    
    // For now, if animal has a specific geofence (from Geofence.findByAnimal)
    const activeFence = await Geofence.findByAnimal(animalId, userId);
    if (activeFence) {
      let isInside = false;
      if (activeFence.type === 'polygon' && activeFence.polygon_coords) {
        const coords = typeof activeFence.polygon_coords === 'string' ? JSON.parse(activeFence.polygon_coords) : activeFence.polygon_coords;
        isInside = isPointInPolygon(point, coords);
      } else if (activeFence.type === 'circle' && activeFence.center_lat) {
        // (Circle logic check would go here)
      }

      if (!isInside) {
        // Trigger alert with linked geofenceId and Name
        await createGeofenceAlert({
          animalId, userId, latitude, longitude,
          distanceM: null, radiusM: activeFence.radius_m,
          geofenceId: activeFence.id,
          geofenceName: activeFence.name
        });
      } else if (animal.status === 'danger') {
        // Auto-safe if back in zone
        await markAnimalSafe(animalId, userId);
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
