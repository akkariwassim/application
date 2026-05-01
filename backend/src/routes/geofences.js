'use strict';

const express = require('express');
const router  = express.Router();
const geofencesController = require('../controllers/geofencesController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');

router.use(authenticate);
router.use(checkRole([]));

router.get('/',      geofencesController.getGeofences);
router.post('/', [
  body('name').trim().notEmpty().withMessage('Le nom de la zone est requis'),
  body('type').isIn(['circle', 'polygon']).withMessage('Le type doit être circle ou polygon'),
  body('centerLat').optional().isFloat({ min: -90, max: 90 }),
  body('centerLon').optional().isFloat({ min: -180, max: 180 }),
  body('radiusM').optional().isFloat({ min: 1 }),
  body('polygonCoords').optional().isArray(),
  validate
], geofencesController.createGeofence);
router.put('/:id',   [
  param('id').isMongoId(), 
  body('name').optional().trim().notEmpty(),
  validate
], geofencesController.updateGeofence);
router.delete('/:id',[param('id').isMongoId(), validate], geofencesController.deleteGeofence);

module.exports = router;
