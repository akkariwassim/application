'use strict';

const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
  user_id: {
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
    required: [true, 'Animal type is required'],
    enum: ['cow', 'sheep', 'goat', 'camel', 'horse', 'bovine', 'ovine', 'caprine', 'equine', 'other'],
    default: 'other',
  },
  breed: String,
  weight_kg: Number,
  birth_date: Date,
  rfid_tag: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true,
  },
  device_id: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true,
  },
  color_hex: {
    type: String,
    default: '#4CAF50',
  },
  status: {
    type: String,
    enum: ['safe', 'warning', 'danger', 'offline'],
    default: 'offline',
  },
  latitude: {
    type: Number,
    default: 0,
  },
  longitude: {
    type: Number,
    default: 0,
  },
  current_location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    }
  },
  current_zone_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
  },
  settings: {
    min_temp: { type: Number, default: 37.5 },
    max_temp: { type: Number, default: 40.0 },
    min_activity: { type: Number, default: 20 },
    max_activity: { type: Number, default: 80 },
    min_heart_rate: { type: Number, default: 40 },
    max_heart_rate: { type: Number, default: 110 },
  },
  temperature: Number,
  heart_rate:  Number, // BPM
  activity:    Number, // Percentage or Level
  battery_level: {
    type: Number,
    default: 100,
  },
  signal_strength: {
    type: Number,
    default: 100,
  },
  actuators: {
    buzzer: { type: Boolean, default: false },
    led: { type: Boolean, default: false },
    relay: { type: Boolean, default: false },
  },
  age: Number,
  notes: String,
  avatar_url: String,
  last_seen: {
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

animalSchema.pre('save', async function() {
  if (this.isModified('latitude') || this.isModified('longitude')) {
    this.current_location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
});

animalSchema.index({ user_id: 1, created_at: -1 });
animalSchema.index({ user_id: 1, status: 1 });
animalSchema.index({ user_id: 1, current_zone_id: 1 });
animalSchema.index({ current_location: '2dsphere' });

const Animal = mongoose.model('Animal', animalSchema);

module.exports = Animal;
