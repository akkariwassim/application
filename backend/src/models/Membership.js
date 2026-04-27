'use strict';

const mongoose = require('mongoose');

<<<<<<< HEAD
/**
 * SCHEMA: Membership (Links Users to Farms with specific Roles)
 */
=======
>>>>>>> origin/main
const membershipSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
<<<<<<< HEAD
    index: true,
=======
>>>>>>> origin/main
  },
  farm_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true,
<<<<<<< HEAD
    index: true,
=======
>>>>>>> origin/main
  },
  role: {
    type: String,
    enum: ['owner', 'worker', 'vet', 'admin'],
    required: true,
    default: 'worker',
  },
  status: {
    type: String,
<<<<<<< HEAD
    enum: ['pending', 'active', 'inactive'],
=======
    enum: ['active', 'pending', 'inactive'],
>>>>>>> origin/main
    default: 'active',
  },
  invited_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
<<<<<<< HEAD
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Unique constraint: A user can only have one membership per farm
=======
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
>>>>>>> origin/main
membershipSchema.index({ user_id: 1, farm_id: 1 }, { unique: true });

const Membership = mongoose.model('Membership', membershipSchema);

module.exports = Membership;
