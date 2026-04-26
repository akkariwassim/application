'use strict';

const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  user_id: {
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
  zone_type: {
    type: String,
    enum: ['grazing', 'exclusion', 'shelter', 'hazard'],
    default: 'grazing',
  },
  polygon_coords: {
    type: mongoose.Schema.Types.Mixed,
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
  center_lat: {
    type: Number,
    default: 0,
  },
  center_lon: {
    type: Number,
    default: 0,
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
  radiusM: Number,
  is_active: {
    type: Boolean,
    default: true,
  },
  is_primary: {
    type: Number, // Mobile expects 1 or 0
    default: 0,
  },
  priority_level: {
    type: Number,
    default: 1,
  },
  animal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    default: null,
  },
  active_alerts: {
    type: Number,
    default: 0,
  },
  fill_color: {
    type: String,
    default: '#4F46E5',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color'],
  },
  area_sqm: Number,
  status: {
    type: String,
    enum: ['safe', 'warning', 'danger'],
    default: 'safe',
  },
  status_color: {
    type: String,
    default: '#22C55E', // Green
  },
  status_reason: {
    type: String,
    default: 'Conditions normales',
  },
  last_status_update: {
    type: Date,
    default: Date.now,
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

zoneSchema.pre('save', async function() {
  if (this.isModified('center_lat') || this.isModified('center_lon')) {
    this.center = {
      type: 'Point',
      coordinates: [this.center_lon, this.center_lat]
    };
  }
});

/**
 * Static helper to find the active zone for an animal.
 * Checks for animal-specific zone first, then falls back to user-level primary zone.
 */
zoneSchema.statics.findByAnimal = async function(animalId, userId) {
  // 1. Look for zone specifically assigned to this animal
  let zone = await this.findOne({ animal_id: animalId, is_active: true });
  if (zone) return zone;

  // 2. Fall back to user's primary/default zone
  zone = await this.findOne({ user_id: userId, is_primary: 1, is_active: true });
  return zone;
};

zoneSchema.index({ geometry: '2dsphere' });
zoneSchema.index({ center: '2dsphere' });

const Zone = mongoose.model('Zone', zoneSchema);

module.exports = Zone;
