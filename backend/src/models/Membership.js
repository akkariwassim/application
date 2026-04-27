'use strict';

const mongoose = require('mongoose');

/**
 * SCHEMA: Membership (Links Users to Farms with specific Roles)
 */
const membershipSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  farm_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['owner', 'worker', 'vet', 'admin'],
    required: true,
    default: 'worker',
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive'],
    default: 'active',
  },
  invited_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Unique constraint: A user can only have one membership per farm
membershipSchema.index({ user_id: 1, farm_id: 1 }, { unique: true });

const Membership = mongoose.model('Membership', membershipSchema);

module.exports = Membership;
