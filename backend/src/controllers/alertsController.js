'use strict';

const Alert = require('../models/Alert');

/**
 * GET /api/alerts
 */
async function getAlerts(req, res, next) {
  try {
    const { status, severity, animalId, type } = req.query;
    
    const query = { user_id: req.user.id };
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (animalId) query.animal_id = animalId;
    if (type) query.type = type;
    
    const alerts = await Alert.find(query).sort({ created_at: -1 });
    res.json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/alerts/:id
 */
async function getAlert(req, res, next) {
  try {
    const { id } = req.params;
    const alert = await Alert.findOne({ _id: id, user_id: req.user.id });
    if (!alert) return res.status(404).json({ 
      success: false,
      error: 'ALERT_NOT_FOUND',
      message: 'Alerte non trouvée.'
    });
    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/alerts/:id/acknowledge
 */
async function acknowledgeAlert(req, res, next) {
  try {
    const { id } = req.params;
    const alert = await Alert.findOneAndUpdate(
      { _id: id, user_id: req.user.id },
      { $set: { status: 'acknowledged', acknowledged_at: new Date() } },
      { new: true }
    );
    
    if (!alert) return res.status(404).json({ 
      success: false,
      error: 'ALERT_NOT_FOUND',
      message: 'Alerte non trouvée.'
    });
    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/alerts/:id/resolve
 */
async function resolveAlert(req, res, next) {
  try {
    const { id } = req.params;
    const alert = await Alert.findOneAndUpdate(
      { _id: id, user_id: req.user.id },
      { $set: { status: 'resolved', resolved_at: new Date() } },
      { new: true }
    );
    
    if (!alert) return res.status(404).json({ 
      success: false,
      error: 'ALERT_NOT_FOUND',
      message: 'Alerte non trouvée.'
    });
    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/alerts/:id
 */
async function deleteAlert(req, res, next) {
  try {
    const { id } = req.params;
    const result = await Alert.deleteOne({ _id: id, user_id: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ 
      success: false,
      error: 'ALERT_NOT_FOUND',
      message: 'Alerte non trouvée.'
    });
    res.json({ success: true, message: 'Alerte supprimée avec succès.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAlerts,
  getAlert,
  acknowledgeAlert,
  resolveAlert,
  deleteAlert
};
