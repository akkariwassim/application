'use strict';

const router   = require('express').Router();
const ctrl     = require('../controllers/devicesController');
const { authenticate } = require('../middleware/auth');

// All device routes require authentication
router.use(authenticate);

// GET /api/devices
router.get('/', ctrl.getDevices);

// GET /api/devices/:id
router.get('/:id', ctrl.getDevice);

// POST /api/devices
router.post('/', ctrl.createDevice);

module.exports = router;
