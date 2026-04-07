'use strict';

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  animalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true,
  },
  zoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
  },
  type: {
    type: String,
    enum: [
      'geofence_exit',
      'geofence_enter',
      'high_temp',
      'low_temp',
      'high_activity',
      'low_activity',
      'battery_low',
      'inactivity'
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  message: String,
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active',
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lon, lat]
    }
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  acknowledgedAt: Date,
  resolvedAt: Date,
}, {
  timestamps: true,
});

// Geo-spatial index for alerts by location
alertSchema.index({ location: '2dsphere' });
alertSchema.index({ animalId: 1, createdAt: -1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
