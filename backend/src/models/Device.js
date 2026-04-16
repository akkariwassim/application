'use strict';

const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: [true, 'Hardware ID is required'],
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['collar', 'tag', 'sensor'],
    default: 'collar',
  },
  status: {
    type: String,
    enum: ['free', 'assigned', 'maintenance', 'lost'],
    default: 'free',
  },
  battery_level: {
    type: Number,
    default: 100,
  },
  last_sync: {
    type: Date,
    default: Date.now,
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
  }
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
