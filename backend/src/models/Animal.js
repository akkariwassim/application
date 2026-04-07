'use strict';

const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Animal name is required'],
    trim: true,
  },
  type: {
    type: String,
    required: [true, 'Animal type is required (e.g., cow, sheep)'],
    trim: true,
  },
  breed: String,
  weightKg: Number,
  birthDate: Date,
  rfidTag: {
    type: String,
    unique: true,
    sparse: true, // Allow nulls while maintaining uniqueness
  },
  deviceId: {
    type: String,
    unique: true,
    sparse: true,
  },
  colorHex: {
    type: String,
    default: '#4CAF50',
  },
  notes: String,
  status: {
    type: String,
    enum: ['healthy', 'sick', 'out_of_zone', 'inactive', 'warning'],
    default: 'healthy',
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    }
  },
  currentZoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
  },
  settings: {
    minTemp: { type: Number, default: 37.5 },
    maxTemp: { type: Number, default: 40.0 },
    minActivity: { type: Number, default: 20 },
    maxActivity: { type: Number, default: 80 },
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

// Geo-spatial index for location queries
animalSchema.index({ currentLocation: '2dsphere' });

const Animal = mongoose.model('Animal', animalSchema);

module.exports = Animal;
