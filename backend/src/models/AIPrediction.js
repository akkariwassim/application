'use strict';

const mongoose = require('mongoose');

const aiPredictionSchema = new mongoose.Schema({
  animal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['NORMAL', 'ATTENTION', 'CRITICAL'],
    default: 'NORMAL',
  },
  risk_score: {
    type: Number,
    min: 0,
    max: 100,
  },
  cause: String,
  recommendation: String,
  confidence: Number,
  timestamp: {
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

aiPredictionSchema.index({ animal_id: 1, timestamp: -1 });

const AIPrediction = mongoose.model('AIPrediction', aiPredictionSchema);

module.exports = AIPrediction;
