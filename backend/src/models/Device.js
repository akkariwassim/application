'use strict';

const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: [true, 'Hardware ID is required'],
    unique: true,
    index: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['free', 'assigned', 'maintenance', 'lost'],
    default: 'free',
    index: true,
  },
  type: {
    type: String,
    enum: ['collar', 'tag', 'sensor', 'drone'],
    default: 'collar',
  },
  battery_level: {
    type: Number,
    default: 100,
  },
  last_sync: {
    type: Date,
    default: Date.now,
  },
  assigned_to_animal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    default: null,
  },
  manufacturer: String,
  production_date: Date,
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

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
