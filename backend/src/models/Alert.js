'use strict';

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  animal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true,
  },
  geofence_id: {
    type: Number,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'geofence_breach', 'high_temperature', 'abnormal_heart_rate', 
      'low_battery', 'no_movement', 'device_offline', 
      'low_gps_signal', 'sensor_failure', 'exit', 'entry'
    ],
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active',
  },
  acknowledged_at: Date,
  resolved_at: Date,
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { 
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

alertSchema.index({ user_id: 1, created_at: -1 });
alertSchema.index({ user_id: 1, status: 1 });
alertSchema.index({ user_id: 1, severity: 1 });
alertSchema.index({ animal_id: 1, created_at: -1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
