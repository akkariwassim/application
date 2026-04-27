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
    trim: true,
  },
  location: {
    latitude:  { type: Number },
    longitude: { type: Number },
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  subscription_status: {
    type: String,
    enum: ['trial', 'active', 'suspended', 'expired'],
    default: 'trial',
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indices for performance
farmSchema.index({ owner_id: 1 });

const Farm = mongoose.model('Farm', farmSchema);

module.exports = Farm;
