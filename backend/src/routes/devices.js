'use strict';

const express = require('express');
const router = express.Router();
const devicesController = require('../controllers/devicesController');
const { authenticate } = require('../middleware/auth');

// All device routes require authentication
router.use(authenticate);

// GET /api/devices
router.get('/', devicesController.getDevices);

// GET /api/devices/:id
router.get('/:id', devicesController.getDevice);

// POST /api/devices
router.post('/', devicesController.createDevice);

// DELETE /api/devices/:id
router.delete('/:id', devicesController.deleteDevice);

module.exports = router;
