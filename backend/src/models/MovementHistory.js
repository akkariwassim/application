'use strict';

const mongoose = require('mongoose');

const movementHistorySchema = new mongoose.Schema({
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
  farm_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: false,
    index: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    }
  },
  speed_kmh: Number,
  altitude_m: Number,
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Optimization for historical queries (Last 24h, Last 7 days)
movementHistorySchema.index({ animal_id: 1, timestamp: -1 });
movementHistorySchema.index({ user_id: 1, timestamp: -1 });

// Geo-spatial index for potential future proximity searches
movementHistorySchema.index({ location: '2dsphere' });

const MovementHistory = mongoose.model('MovementHistory', movementHistorySchema);

module.exports = MovementHistory;
