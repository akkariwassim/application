'use strict';

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: String,
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true
  },
  file_url: String, // Path to generated PDF
  period_start: Date,
  period_end: Date,
  metadata: {
    animal_count: Number,
    alert_count: Number,
    generation_time_ms: Number
  }
}, {
  timestamps: { createdAt: 'created_at' }
});

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
