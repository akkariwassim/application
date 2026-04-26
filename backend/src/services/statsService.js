'use strict';

const MovementHistory = require('../models/MovementHistory');
const HealthLog = require('../models/HealthLog');
const StatisticsCache = require('../models/StatisticsCache');
const { haversineDistance } = require('./geofenceService');
const logger = require('../utils/logger');

class StatsService {
  
  /**
   * Logs a new position and vital signs into historical collections.
   */
  async logMetrics(animal, data) {
    try {
      const { latitude, longitude, temperature, heart_rate, activity, speed } = data;
      
      // 1. Log Movement
      if (latitude && longitude) {
        await MovementHistory.create({
          animal_id: animal._id,
          user_id: animal.user_id,
          location: { type: 'Point', coordinates: [longitude, latitude] },
          speed_kmh: speed || 0,
          timestamp: new Date()
        });
      }

      // 2. Log Health
      await HealthLog.create({
        animal_id: animal._id,
        user_id: animal.user_id,
        temperature: temperature || animal.temperature,
        heart_rate: heart_rate || animal.heart_rate,
        activity_level: activity || animal.activity,
        status: animal.status || 'safe',
        timestamp: new Date()
      });

    } catch (err) {
      logger.error(`[StatsService] Logging failed: ${err.message}`);
    }
  }

  /**
   * Aggregates daily stats for an animal.
   * Calculates distance by summing haversine between consecutive points.
   */
  async calculateDailyStats(animalId, date = new Date()) {
    const start = new Date(date).setHours(0, 0, 0, 0);
    const end = new Date(date).setHours(23, 59, 59, 999);

    const points = await MovementHistory.find({
      animal_id: animalId,
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: 1 });

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i-1].location.coordinates;
      const p2 = points[i].location.coordinates;
      totalDistance += haversineDistance(p1[1], p1[0], p2[1], p2[0]);
    }

    const healthLogs = await HealthLog.find({
      animal_id: animalId,
      timestamp: { $gte: start, $lte: end }
    });

    const avgTemp = healthLogs.reduce((acc, log) => acc + (log.temperature || 0), 0) / (healthLogs.length || 1);
    const avgHR = healthLogs.reduce((acc, log) => acc + (log.heart_rate || 0), 0) / (healthLogs.length || 1);

    return {
      distance_traveled_km: (totalDistance / 1000).toFixed(2),
      avg_temp: avgTemp.toFixed(1),
      avg_heart_rate: Math.round(avgHR),
      active_hours: healthLogs.filter(l => l.activity_level > 20).length * (10 / 60), // Assuming 10-min logs
      idle_hours: healthLogs.filter(l => l.activity_level <= 20).length * (10 / 60)
    };
  }
}

module.exports = new StatsService();
