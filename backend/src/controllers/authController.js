'use strict';

const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const User    = require('../models/User');
const logger  = require('../utils/logger');

const SALT_ROUNDS = 10;

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;

    // Check uniqueness
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = await User.create({ name, email, passwordHash, phone });
    const user   = await User.findById(userId);

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await User.saveRefreshToken(userId, hashToken(refreshToken), expiresAt);

    logger.info(`New user registered: ${email}`);
    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await User.saveRefreshToken(user.id, hashToken(refreshToken), expiresAt);

    // Remove sensitive fields before returning
    const { password_hash, ...safeUser } = user;

    logger.info(`User logged in: ${email}`);
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ error: 'Refresh token required' });

    const hash = hashToken(token);
    const stored = await User.findRefreshToken(hash);
    if (!stored) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(stored.user_id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const newAccessToken  = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    const expiresAt       = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await User.revokeRefreshToken(hash);
    await User.saveRefreshToken(user.id, hashToken(newRefreshToken), expiresAt);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await User.revokeRefreshToken(hashToken(token));
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refreshToken, logout, me };
