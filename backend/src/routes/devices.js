'use strict';

const express = require('express');
const router = express.Router();
const devicesController = require('../controllers/devicesController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

// All device routes require authentication and farm context
router.use(authenticate);
router.use(checkRole([]));

// GET /api/devices
router.get('/', devicesController.getDevices);

// GET /api/devices/:id
router.get('/:id', devicesController.getDevice);

// POST /api/devices (Admin only)
router.post('/', checkRole(['admin', 'owner']), devicesController.createDevice);

// DELETE /api/devices/:id (Admin only)
router.delete('/:id', checkRole(['admin', 'owner']), devicesController.deleteDevice);

module.exports = router;
