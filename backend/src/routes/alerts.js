'use strict';

const router   = require('express').Router();
const { param, query } = require('express-validator');
const ctrl     = require('../controllers/alertsController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/alerts
router.get('/', [
  query('severity').optional().isIn(['low','medium','high','critical']),
  query('status').optional().isIn(['active','acknowledged','resolved','archived']),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  validate
], ctrl.getAlerts);

// GET /api/alerts/:id
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid alert ID'),
  validate
], ctrl.getAlert);

// PUT /api/alerts/:id/acknowledge
router.put('/:id/acknowledge', [
  param('id').isMongoId().withMessage('Invalid alert ID'),
  validate
], ctrl.acknowledgeAlert);

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', [
  param('id').isMongoId().withMessage('Invalid alert ID'),
  validate
], ctrl.resolveAlert);

// DELETE /api/alerts/:id
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid alert ID'),
  validate
], ctrl.deleteAlert);

module.exports = router;
