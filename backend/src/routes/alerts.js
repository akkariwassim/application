'use strict';

const router   = require('express').Router();
const { param, query } = require('express-validator');
const ctrl     = require('../controllers/alertsController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/alerts
router.get('/', [
  query('severity').optional().isIn(['info','warning','critical']),
  query('status').optional().isIn(['active','acknowledged','resolved','archived']),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  validate
], ctrl.listAlerts);

// GET /api/alerts/:id
router.get('/:id', [
  param('id').isInt({ min: 1 }),
  validate
], ctrl.getAlert);

// PUT /api/alerts/:id/acknowledge
router.put('/:id/acknowledge', [
  param('id').isInt({ min: 1 }),
  validate
], ctrl.acknowledgeAlert);

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', [
  param('id').isInt({ min: 1 }),
  validate
], ctrl.resolveAlert);

// DELETE /api/alerts/:id
router.delete('/:id', [
  param('id').isInt({ min: 1 }),
  validate
], ctrl.deleteAlert);

module.exports = router;
