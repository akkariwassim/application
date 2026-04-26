'use strict';

const mongoose = require('mongoose');

const healthLogSchema = new mongoose.Schema({
  animal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  temperature: Number,
  heart_rate: Number,
  activity_level: Number, // 0-100
  stress_score: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['safe', 'warning', 'danger'],
    default: 'safe'
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

healthLogSchema.index({ animal_id: 1, timestamp: -1 });

const HealthLog = mongoose.model('HealthLog', healthLogSchema);

module.exports = HealthLog;
