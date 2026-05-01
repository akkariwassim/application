'use strict';

const mongoose = require('mongoose');

/**
 * SCHEMA: Farm (The primary multi-tenant unit)
 */
const farmSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nom de la ferme requis'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  location: {
    latitude:  { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  settings: {
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD' },
    unit_system: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
  },
  subscription_status: {
    type: String,
    enum: ['trial', 'active', 'suspended', 'expired', 'past_due', 'canceled'],
    default: 'trial',
  },
  metadata: {
    type: Map,
    of: String
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

// Indices for performance
farmSchema.index({ owner_id: 1 });
const Farm = mongoose.model('Farm', farmSchema);

module.exports = Farm;
