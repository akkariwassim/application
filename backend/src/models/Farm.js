'use strict';

const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Farm name is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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

const Farm = mongoose.model('Farm', farmSchema);

module.exports = Farm;
