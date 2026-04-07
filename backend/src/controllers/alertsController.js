'use strict';

const Alert = require('../models/Alert');

/**
 * GET /api/alerts
 */
async function listAlerts(req, res, next) {
  try {
    const { animalId, severity, status, limit = 50, offset = 0 } = req.query;
    
    const query = { userId: req.user.id };
    if (animalId) query.animalId = animalId;
    if (severity) query.severity = severity;
    if (status) query.status = status;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('animalId', 'name type')
      .populate('zoneId', 'name');

    res.json(alerts);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/alerts/:id
 */
async function getAlert(req, res, next) {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('animalId')
      .populate('zoneId');
      
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/alerts/:id/acknowledge
 */
async function acknowledgeAlert(req, res, next) {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, status: 'active' },
      { 
        $set: { 
          status: 'acknowledged',
          acknowledgedBy: req.user.id,
          acknowledgedAt: new Date()
        } 
      },
      { new: true }
    );

    if (!alert) return res.status(404).json({ error: 'Alert not found or already acknowledged' });
    res.json(alert);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/alerts/:id/resolve
 */
async function resolveAlert(req, res, next) {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, status: { $ne: 'resolved' } },
      { 
        $set: { 
          status: 'resolved',
          resolvedAt: new Date()
        } 
      },
      { new: true }
    );

    if (!alert) return res.status(404).json({ error: 'Alert not found or already resolved' });
    res.json(alert);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/alerts/:id
 */
async function deleteAlert(req, res, next) {
  try {
    const result = await Alert.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts, getAlert, acknowledgeAlert, resolveAlert, deleteAlert };
