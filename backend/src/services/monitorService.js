'use strict';

const Alert           = require('../models/Alert');
const Zone            = require('../models/Zone');
const geofenceService = require('../services/geofenceService');
const socketConfig    = require('../config/socket');
const logger          = require('../utils/logger');

/**
 * Monitor Service
 * Professional engine for evaluating real-time IoT metrics and triggering business logic.
 */
class MonitorService {
  
  /**
   * Evaluates animal position against its assigned geofence
   */
  async checkGeofence(animal, latitude, longitude) {
    try {
      const activeZone = await Zone.findByAnimal(animal.id, animal.user_id);
      if (!activeZone || !activeZone.is_active) return 'safe';

      // Evaluate breach using the professional geofence logic
      const checkResult = geofenceService.checkBreach(latitude, longitude, activeZone);

      if (checkResult.breached) {
        // Prevent alert flooding: check if an active breach alert already exists
        const existing = await Alert.findOne({ 
          animal_id: animal.id, 
          type: 'geofence_breach', 
          status: 'active' 
        });

        if (!existing) {
          const alert = await Alert.create({
            animal_id: animal.id,
            user_id: animal.user_id,
            geofence_id: activeZone.id,
            type: 'geofence_breach',
            severity: 'critical',
            message: `🚨 ${animal.name} est HORS ZONE (${activeZone.name})`,
            location: { type: 'Point', coordinates: [longitude, latitude] }
          });

          socketConfig.emitAlert(animal.user_id, animal.id, alert);
          socketConfig.emitStatusChange(animal.user_id, animal.id, 'danger');
          return 'danger';
        }
        return 'danger';
      } else {
        // Animal is inside. If previously danger, recover.
        if (animal.status === 'danger') {
          socketConfig.emitStatusChange(animal.user_id, animal.id, 'safe');
          return 'safe';
        }
      }
      return animal.status;
    } catch (err) {
      logger.error(`[MonitorService] Geofence Error: ${err.message}`);
      return animal.status;
    }
  }

  /**
   * Evaluates vital signs and hardware health
   */
  async checkVitals(animal, metrics, location) {
    const { temperature, heart_rate, battery_level, gps_signal } = metrics;
    const healthAlerts = [];

    // 1. Logic Evaluation using dynamic settings
    const { settings = {} } = animal;
    const minT = settings.min_temp || 37.5;
    const maxT = settings.max_temp || 40.0;
    const minB = settings.min_heart_rate || 40;
    const maxB = settings.max_heart_rate || 110;

    if (temperature > maxT) {
      healthAlerts.push({ type: 'high_temperature', severity: 'high', msg: `Température critique: ${temperature}°C (> ${maxT}°C)` });
    } else if (temperature < minT && temperature > 0) {
      healthAlerts.push({ type: 'low_temperature', severity: 'medium', msg: `Température basse: ${temperature}°C (< ${minT}°C)` });
    }

    if (heart_rate > maxB) {
      healthAlerts.push({ type: 'abnormal_heart_rate', severity: 'critical', msg: `Tachycardie détectée: ${heart_rate} BPM (> ${maxB})` });
    } else if (heart_rate > 0 && heart_rate < minB) {
      healthAlerts.push({ type: 'abnormal_heart_rate', severity: 'critical', msg: `Bradycardie détectée: ${heart_rate} BPM (< ${minB})` });
    }

    if (battery_level < 15) {
      healthAlerts.push({ type: 'low_battery', severity: 'medium', msg: `Batterie Collier Critique: ${battery_level}%` });
    }
    if (gps_signal < 2 && gps_signal !== undefined) {
      healthAlerts.push({ type: 'low_gps_signal', severity: 'low', msg: `Signal GPS instable` });
    }

    // 2. Alert Processing with Deduplication
    for (const hAlert of healthAlerts) {
      try {
        const existing = await Alert.findOne({ 
          animal_id: animal.id, 
          type: hAlert.type, 
          status: 'active' 
        });

        if (!existing) {
          const alert = await Alert.create({
            animal_id: animal.id,
            user_id: animal.user_id,
            type: hAlert.type,
            severity: hAlert.severity,
            message: `🩺 ${animal.name}: ${hAlert.msg}`,
            location: { type: 'Point', coordinates: [location.longitude, location.latitude] }
          });
          socketConfig.emitAlert(animal.user_id, animal.id, alert);
        }
      } catch (err) {
        logger.error(`[MonitorService] Vital Check Error: ${err.message}`);
      }
    }
  }

  /**
   * Determines if a position update should be persisted based on movement/time thresholds
   * Professional Persistence Throttling logic.
   */
  shouldPersist(lastSync, lastPos, newPos) {
    if (!lastSync || !lastPos) return true;

    const timeDiffMs = new Date() - new Date(lastSync);
    const timeThresholdMs = 60 * 1000; // 1 minute

    // Always persist if more than 1 minute passed
    if (timeDiffMs > timeThresholdMs) return true;

    // Persist if significant movement (> 5 meters)
    const { getDistance } = require('geolib');
    const distance = getDistance(
      { latitude: lastPos.latitude, longitude: lastPos.longitude },
      { latitude: newPos.latitude, longitude: newPos.longitude }
    );

    return distance > 5;
  }
}

module.exports = new MonitorService();
