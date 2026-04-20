'use strict';

const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['free', 'assigned', 'maintenance'],
    default: 'free',
    index: true,
  },
  type: {
    type: String,
    enum: ['collar', 'tag', 'drone'],
    default: 'collar',
  },
  battery_level: {
    type: Number,
    default: 100,
  },
  last_ping: {
    type: Date,
    default: Date.now,
  },
  assigned_to_animal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    default: null,
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Device', deviceSchema);
