'use strict';

const mongoose = require('mongoose');

<<<<<<< HEAD
/**
 * SCHEMA: Farm (The primary multi-tenant unit)
 */
const farmSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nom de la ferme requis'],
=======
const farmSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Farm name is required'],
>>>>>>> origin/main
    trim: true,
  },
  description: {
    type: String,
<<<<<<< HEAD
    trim: true,
  },
  location: {
    latitude:  { type: Number },
    longitude: { type: Number },
=======
    default: '',
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
>>>>>>> origin/main
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
<<<<<<< HEAD
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

=======
  },
  settings: {
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD' },
    unit_system: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
  },
  subscription_status: {
    type: String,
    enum: ['active', 'trial', 'past_due', 'canceled'],
    default: 'trial',
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
  }
});

>>>>>>> origin/main
const Farm = mongoose.model('Farm', farmSchema);

module.exports = Farm;
