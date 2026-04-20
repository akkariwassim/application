'use strict';

const express = require('express');
const router = express.Router();
const devicesController = require('../controllers/devicesController');
const { authenticate } = require('../middleware/auth');

// All device routes require authentication
router.use(authenticate);

router.get('/', devicesController.getDevices);
router.post('/', devicesController.createDevice);
router.delete('/:id', devicesController.deleteDevice);

module.exports = router;
