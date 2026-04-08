'use strict';

const router  = require('express').Router();
const { body }   = require('express-validator');
const ctrl    = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const passwordRule = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .matches(/^(?=.*[A-Z])(?=.*\d)/)
  .withMessage('Password must contain at least one uppercase letter and one number');

// POST /api/auth/register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  passwordRule,
  validate
], ctrl.register);

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate
], ctrl.login);

// POST /api/auth/refresh
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('refreshToken is required'),
  validate
], ctrl.refreshToken);

// POST /api/auth/logout
router.post('/logout', ctrl.logout);

// GET /api/auth/me  (protected)
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
