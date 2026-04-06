'use strict';

const Alert   = require('../models/Alert');
const Animal  = require('../models/Animal');
const { pool } = require('../config/database');
const { emitAlert, emitStatusChange } = require('../config/socket');
const logger  = require('../utils/logger');

/**
 * Alert Service
 * Handles alert creation, deduplication, and real-time notifications.
 */

async function createGeofenceAlert({ animalId, userId, latitude, longitude, distanceM, radiusM }) {
  try {
    // Deduplication: check if an active geofence alert exists in the last 15 mins
    const [recent] = await pool.query(
      "SELECT id FROM alerts WHERE animal_id = ? AND type = 'geofence_breach' AND created_at > NOW() - INTERVAL 15 MINUTE LIMIT 1",
      [animalId]
    );
    if (recent.length > 0) return null;

    const message = distanceM !== null
      ? `Animal a franchi le périmètre de sécurité ! Distance : ${distanceM}m (rayon : ${radiusM}m).`
      : `Animal a franchi le périmètre de sécurité (zone polygone).`;

    const alertId = await Alert.create({
      animalId,
      userId,
      type:      'geofence_breach',
      severity:  'critical',
      message,
      latitude,
      longitude
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

module.exports = {
  createGeofenceAlert,
  createHealthAlert,
  markAnimalSafe
};
