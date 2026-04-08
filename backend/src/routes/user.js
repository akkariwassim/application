'use strict';

const express = require('express');
const router  = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/user/ping
 * @desc    Get diagnostic ping
 */
router.get('/ping', userController.ping);

// Apply authentication to all user routes
router.use(authenticate);

/**
 * @route   PUT /api/user/update-name
 * @desc    Update user profile name
 */
router.put('/update-name', userController.updateName);

/**
 * @route   PUT /api/user/change-password
 * @desc    Change user password after verification
 */
router.put('/change-password', userController.changePassword);

/**
 * @route   PUT /api/user/update-phone
 * @desc    Update user phone number
 */
router.put('/update-phone', userController.updatePhone);

/**
 * @route   PUT /api/user/update-profile
 * @desc    Unified profile update (name, email, phone, password)
 */
router.put('/update-profile', userController.updateProfile);

module.exports = router;
