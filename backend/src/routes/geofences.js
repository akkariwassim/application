'use strict';

const express = require('express');
const router  = express.Router();
const geofencesController = require('../controllers/geofencesController');
const { authenticate }   = require('../middleware/auth');

router.use(authenticate);

router.get('/',      geofencesController.getGeofences);
router.post('/',     geofencesController.createGeofence);
router.put('/:id',   geofencesController.updateGeofence);
router.delete('/:id',geofencesController.deleteGeofence);

module.exports = router;
