'use strict';

const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Zone name is required'],
    trim: true,
  },
  description: String,
  type: {
    type: String,
    enum: ['grazing', 'exclusion', 'shelter', 'hazard'],
    default: 'grazing',
  },
  geometry: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon',
      required: true,
    },
    coordinates: {
      type: [[[Number]]], // [[[lon, lat], [lon, lat], ...]]
      required: true,
    }
  },
  center: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    }
  },
  radiusM: Number, // Optional, for circular geofences
  isActive: {
    type: Boolean,
    default: true,
  },
  priorityLevel: {
    type: Number,
    default: 1,
  },
  fillColor: {
    type: String,
    default: '#4F46E5',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color'],
  },
  areaSqm: Number,
}, {
  timestamps: true,
});

// Geo-spatial index for geometry queries
zoneSchema.index({ geometry: '2dsphere' });
zoneSchema.index({ center: '2dsphere' });

const Zone = mongoose.model('Zone', zoneSchema);

module.exports = Zone;
