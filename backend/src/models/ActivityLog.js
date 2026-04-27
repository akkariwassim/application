'use strict';

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
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
  action: {
    type: String,
    required: true, // e.g., 'ADD_ANIMAL', 'EDIT_ZONE', 'DELETE_DATA', 'EXPORT_REPORT'
  },
  entity_type: {
    type: String, // 'Animal', 'Zone', 'User', 'Report', etc.
  },
  entity_id: {
    type: mongoose.Schema.Types.ObjectId,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  ip_address: String,
  user_agent: String,
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

activityLogSchema.index({ farm_id: 1, created_at: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
