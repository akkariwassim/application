'use strict';

const express = require('express');
const router  = express.Router();
const geofencesController = require('../controllers/geofencesController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');
const { param } = require('express-validator');
const validate = require('../middleware/validate');

router.use(authenticate);
router.use(checkRole([]));

router.get('/',      geofencesController.getGeofences);
router.post('/',     geofencesController.createGeofence);
router.put('/:id',   [param('id').isMongoId(), validate], geofencesController.updateGeofence);
router.delete('/:id',[param('id').isMongoId(), validate], geofencesController.deleteGeofence);

module.exports = router;
