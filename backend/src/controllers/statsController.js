'use strict';

const mongoose = require('mongoose');
const statsService = require('../services/statsService');
const HealthLog = require('../models/HealthLog');
const MovementHistory = require('../models/MovementHistory');
const logger = require('../utils/logger');

/**
 * GET /api/stats/animal/:animalId
 * Returns daily/weekly metrics for an animal.
 */
async function getAnimalStats(req, res, next) {
  try {
    const { animalId } = req.params;
    const { period = 'daily' } = req.query;

    // For now, calculate on the fly (can be cached later)
    const stats = await statsService.calculateDailyStats(animalId);
    
    // Fetch trends for charts
    const limit = period === 'weekly' ? 7 * 24 : 24; // approx logs
    const healthTrends = await HealthLog.find({ animal_id: animalId })
      .sort({ timestamp: -1 })
      .limit(limit);

    res.json({ 
      success: true, 
      data: {
        summary: stats,
        trends: healthTrends.reverse()
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/stats/farm
 * Returns aggregated farm statistics.
 */
async function getFarmStats(req, res, next) {
  try {
    const farmId = new mongoose.Types.ObjectId(req.farm_id);
    const Animal = require('../models/Animal');
    const Zone = require('../models/Zone');
    const Alert = require('../models/Alert');

    const [animalCount, zoneCount, activeAlerts, healthSummary] = await Promise.all([
      Animal.countDocuments({ farm_id: farmId }),
      Zone.countDocuments({ farm_id: farmId }),
      Alert.countDocuments({ farm_id: farmId, is_resolved: false }),
      Animal.aggregate([
        { $match: { farm_id: farmId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    res.json({ 
      success: true, 
      data: {
        totals: {
          animals: animalCount,
          zones: zoneCount,
          alerts: activeAlerts
        },
        healthDistribution: healthSummary,
        lastUpdated: new Date()
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAnimalStats,
  getFarmStats
};
