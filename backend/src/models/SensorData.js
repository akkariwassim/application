'use strict';

const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
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
  latitude: Number,
  longitude: Number,
  temperature: Number,
  activity: {
    type: Number,
    min: 0,
    max: 100,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  battery_level: Number,
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

sensorDataSchema.index({ animal_id: 1, timestamp: -1 });

const SensorData = mongoose.model('SensorData', sensorDataSchema);

module.exports = SensorData;
