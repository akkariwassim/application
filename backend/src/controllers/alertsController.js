'use strict';

const Alert = require('../models/Alert');

/**
 * GET /api/alerts
 */
async function listAlerts(req, res, next) {
  try {
    const { animalId, severity, status, limit, offset } = req.query;
    const alerts = await Alert.findByUser(req.user.id, { animalId, severity, status, limit, offset });
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
    const alert = await Alert.findById(req.params.id, req.user.id);
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
    const ok = await Alert.acknowledge(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Alert not found or already acknowledged' });
    const alert = await Alert.findById(req.params.id, req.user.id);
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
    const ok = await Alert.resolve(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Alert not found or already resolved' });
    const alert = await Alert.findById(req.params.id, req.user.id);
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
    const ok = await Alert.delete(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts, getAlert, acknowledgeAlert, resolveAlert, deleteAlert };
