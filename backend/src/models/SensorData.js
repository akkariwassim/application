'use strict';

const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  animalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    }
  },
  metrics: {
    temperature: {
      type: Number,
      required: true,
    },
    activity: {
      type: Number,
      required: true,
    },
    battery: Number,
    speedMps: Number,
  },
  metadata: {
    deviceId: String,
    signalStrength: Number,
  }
}, {
  // Use time-series optimization if using MongoDB 5.0+ 
  // (Note: To enable natively, would require createCollection with timeseries option)
  // For now, standard collection with compound index is robust
  timestamps: false,
});

// Compound index for efficient historical queries per animal
sensorDataSchema.index({ animalId: 1, timestamp: -1 });

// Geo-spatial index for trajectory analysis
sensorDataSchema.index({ location: '2dsphere' });

const SensorData = mongoose.model('SensorData', sensorDataSchema);

module.exports = SensorData;
