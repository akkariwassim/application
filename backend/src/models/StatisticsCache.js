'use strict';

const mongoose = require('mongoose');

const statisticsCacheSchema = new mongoose.Schema({
  animal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: false, // can be null for farm-wide stats
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true
  },
  date_ref: {
    type: Date, // The start date of the period (e.g., 2026-04-26)
    required: true
  },
  metrics: {
    distance_traveled_km: Number,
    active_hours: Number,
    idle_hours: Number,
    avg_speed_kmh: Number,
    avg_temp: Number,
    avg_heart_rate: Number,
    incident_count: Number,
    escape_attempts: Number,
    battery_uptime_pct: Number
  }
}, {
  timestamps: true
});

statisticsCacheSchema.index({ user_id: 1, animal_id: 1, type: 1, date_ref: -1 });

const StatisticsCache = mongoose.model('StatisticsCache', statisticsCacheSchema);

module.exports = StatisticsCache;
