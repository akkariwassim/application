'use strict';

const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  farm_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true,
  },
  role: {
    type: String,
    enum: ['owner', 'worker', 'vet', 'admin'],
    required: true,
    default: 'worker',
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'inactive'],
    default: 'active',
  },
  invited_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  joined_at: {
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
  }
});

// Compound index to ensure a user has only one membership per farm
membershipSchema.index({ user_id: 1, farm_id: 1 }, { unique: true });

const Membership = mongoose.model('Membership', membershipSchema);

module.exports = Membership;
