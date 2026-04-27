'use strict';

const ActivityLog = require('../models/ActivityLog');

/**
 * List activity logs for a farm
 */
async function listLogs(req, res, next) {
  try {
    const logs = await ActivityLog.find({ farm_id: req.farm_id })
      .populate('user_id', 'name email')
      .sort({ created_at: -1 })
      .limit(100);
    
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

module.exports = { listLogs };
