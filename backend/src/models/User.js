'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false, // Don't return password by default
  },
  role: {
    type: String,
    enum: ['farmer', 'admin'],
    default: 'farmer',
  },
  phone: {
    type: String,
    trim: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  refresh_tokens: [{
    token: String,
    expiresAt: Date,
  }],
  farm_latitude: {
    type: Number,
    default: null
  },
  farm_longitude: {
    type: Number,
    default: null
  },
  farm_name: {
    type: String,
    default: 'Ma Ferme'
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

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
