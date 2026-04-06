'use strict';

const Alert   = require('../models/Alert');
const Animal  = require('../models/Animal');
const { emitAlert, emitStatusChange } = require('../config/socket');
const logger  = require('../utils/logger');

/**
 * Alert Service
 * Handles alert creation, deduplication, and real-time notifications.
 */

/**
 * Create a geofence breach alert and update animal status.
 *
 * @param {Object} opts
 * @param {number} opts.animalId
 * @param {number} opts.userId
 * @param {number} opts.latitude
 * @param {number} opts.longitude
 * @param {number} opts.distanceM  - Distance from geofence centre in metres
 * @param {number} opts.radiusM    - Geofence radius
 * @returns {Promise<Object>}       Alert record
 */
async function createGeofenceAlert({ animalId, userId, latitude, longitude, distanceM, radiusM }) {
  try {
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

    // Update animal status to 'danger'
    await Animal.updateStatus(animalId, 'danger');

    const alertPayload = {
      id:        alertId,
      type:      'geofence_breach',
      severity:  'critical',
      message,
      latitude,
      longitude,
      createdAt: new Date().toISOString()
    };

    // Emit via WebSocket
    emitAlert(userId, animalId, alertPayload);
    emitStatusChange(userId, animalId, 'danger');

    logger.warn(`🚨 Geofence breach — animal ${animalId}, user ${userId}: ${message}`);

    return { alertId, ...alertPayload };
  } catch (err) {
    logger.error('Failed to create geofence alert:', err.message);
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
  markAnimalSafe
};
