'use strict';

const Zone = require('../models/Zone');
const Animal = require('../models/Animal');
const Alert = require('../models/Alert');
const socketConfig = require('../config/socket');
const logger = require('../utils/logger');

/**
 * Zone Monitor Service
 * Aggregates animal data and alerts to determine the health of a farm zone.
 */
class ZoneMonitorService {
  
  /**
   * Evaluates the status of a specific zone based on internal business logic.
   */
  async evaluateZone(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) return;

      const animals = await Animal.find({ current_zone_id: zoneId });
      const activeAlerts = await Alert.find({ 
        geofence_id: zoneId, 
        status: 'active' 
      });

      let status = 'safe';
      let reason = 'Conditions normales';
      let color = '#22C55E'; // Green

      // ── RED Logic ──
      const escapedCount = animals.filter(a => a.status === 'danger').length;
      const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;

      if (escapedCount > 0 || criticalAlerts > 0) {
        status = 'danger';
        color = '#EF4444'; // Red
        reason = escapedCount > 0 
          ? `${escapedCount} animal/aux hors zone !` 
          : 'Alertes critiques détectées';
      } 
      // ── ORANGE Logic ──
      else {
        const warningCount = animals.filter(a => a.status === 'warning').length;
        const offlineCount = animals.filter(a => a.status === 'offline').length;
        const lowBattery = animals.filter(a => a.battery_level < 20).length;
        const highAlerts = activeAlerts.filter(a => a.severity === 'high' || a.severity === 'medium').length;

        if (warningCount > 0 || offlineCount > 0 || highAlerts > 0 || lowBattery > 0) {
          status = 'warning';
          color = '#F59E0B'; // Orange
          if (warningCount > 0) reason = 'Activité suspecte détectée';
          else if (offlineCount > 0) reason = 'Dispositif hors ligne';
          else if (lowBattery > 0) reason = 'Batterie faible détectée';
          else reason = 'Alertes de maintenance actives';
        }
      }

      // Check if status changed
      if (zone.status !== status || zone.status_reason !== reason) {
        zone.status = status;
        zone.status_color = color;
        zone.status_reason = reason;
        zone.last_status_update = new Date();
        await zone.save();

        logger.info(`[ZoneMonitor] Zone "${zone.name}" changed status to ${status.toUpperCase()}`);
        
        // Broadcast to mobile apps
        socketConfig.getIO().to(`user:${zone.user_id}`).emit('zone-status-change', {
          zoneId: zone._id,
          status,
          color,
          reason,
          timestamp: zone.last_status_update
        });

        // Trigger Alert if it becomes RED and didn't have one
        if (status === 'danger') {
           const existingZoneAlert = await Alert.findOne({
             geofence_id: zone._id,
             type: 'zone_danger',
             status: 'active'
           });

           if (!existingZoneAlert) {
             const alert = await Alert.create({
               user_id: zone.user_id,
               geofence_id: zone._id,
               type: 'zone_danger',
               severity: 'critical',
               message: `⚠️ ZONE EN DANGER: ${zone.name} - ${reason}`,
               location: zone.center // Use zone center if available
             });
             socketConfig.emitAlert(zone.user_id, null, alert);
           }
        }
      }

      return zone;
    } catch (err) {
      logger.error(`[ZoneMonitorService] Error evaluating zone ${zoneId}: ${err.message}`);
    }
  }

  /**
   * Evaluates all active zones for a user (useful for periodic cleanup or startup)
   */
  async evaluateUserZones(userId) {
    const zones = await Zone.find({ user_id: userId, is_active: true });
    for (const zone of zones) {
      await this.evaluateZone(zone._id);
    }
  }
}

module.exports = new ZoneMonitorService();
