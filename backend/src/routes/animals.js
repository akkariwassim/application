'use strict';

const router   = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl     = require('../controllers/animalsController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

// All animals routes require authentication and farm context
router.use(authenticate);
router.use(checkRole([])); // Ensures farm membership and attaches req.farm_id

const idParam = param('id').isMongoId().withMessage('Invalid ID format');

// GET /api/animals
router.get('/', ctrl.getAnimals);

// POST /api/animals/bulk
router.post('/bulk', [
  body('animals').isArray({ min: 1 }).withMessage('An array of animals is required'),
  validate
], ctrl.bulkCreateAnimals);

// POST /api/animals
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('type').isIn(['cow','sheep','goat','camel','horse','bovine','ovine','caprine','equine','other']).withMessage('Invalid animal type'),
  body('weightKg').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('colorHex').optional({ values: 'falsy' }).matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid hex color'),
  body('currentZoneId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid Zone ID format'),
  validate
], ctrl.createAnimal);

// GET /api/animals/:id
router.get('/:id', [idParam, validate], ctrl.getAnimal);

// PUT /api/animals/:id
router.put('/:id', [
  idParam,
  body('name').optional().trim().notEmpty(),
  body('type').optional({ values: 'falsy' }).isIn(['cow','sheep','goat','camel','horse','bovine','ovine','caprine','equine','other']),
  body('weightKg').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  validate
], ctrl.updateAnimal);

// DELETE /api/animals/:id
router.delete('/:id', [idParam, validate], ctrl.deleteAnimal);

// POST /api/animals/:id/geofence
router.post('/:id/geofence', [
  idParam,
  body('type').isIn(['circle','polygon']).withMessage('type must be circle or polygon'),
  body('centerLat').if(body('type').equals('circle')).isFloat({ min: -90, max: 90 }),
  body('centerLon').if(body('type').equals('circle')).isFloat({ min: -180, max: 180 }),
  body('radiusM').if(body('type').equals('circle')).isFloat({ min: 1 }).withMessage('radius must be > 0'),
  body('polygonCoords').if(body('type').equals('polygon')).isArray({ min: 3 }),
  validate
], ctrl.setZone);

// GET /api/animals/:id/geofence
router.get('/:id/geofence', [idParam, validate], ctrl.getZone);

// POST /api/animals/:id/action
router.post('/:id/action', [
  idParam,
  body('type').isIn(['buzzer','led','relay']).withMessage('Invalid action type'),
  body('state').isBoolean().withMessage('State must be boolean'),
  validate
], ctrl.triggerAction);

module.exports = router;
