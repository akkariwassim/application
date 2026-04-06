'use strict';

const router   = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl     = require('../controllers/positionsController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

// POST /api/positions — can be called by firmware (token auth) or app
router.post('/', [
  authenticate,
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  validate
], ctrl.submitPosition);

// Protected routes below
router.use(authenticate);

// GET /api/positions/:animalId
router.get('/:animalId', [
  param('animalId').isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  validate
], ctrl.getHistory);

// GET /api/positions/:animalId/latest
router.get('/:animalId/latest', [
  param('animalId').isInt({ min: 1 }),
  validate
], ctrl.getLatest);

module.exports = router;
