'use strict';

const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  farm_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'manual'],
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed, // The actual snapshot data or a link to it
    required: true,
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  size_bytes: Number,
  status: {
    type: String,
    enum: ['completed', 'failed', 'restored'],
    default: 'completed',
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

backupSchema.index({ farm_id: 1, created_at: -1 });

const Backup = mongoose.model('Backup', backupSchema);

module.exports = Backup;
