'use strict';

const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const User    = require('../models/User');
const winston = require('winston');

function generateAccessToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
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
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Passwords are hashed in the model pre-save hook
    const user = await User.create({ name, email, password, phone });

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    user.refreshTokens.push({ token: hashToken(refreshToken), expiresAt });
    await user.save();

    winston.info(`New user registered: ${email}`);
    
    // Convert to plain object and remove password
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshTokens;

    res.status(201).json({ user: userObj, accessToken, refreshToken });
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

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    user.refreshTokens.push({ token: hashToken(refreshToken), expiresAt });
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshTokens;

    winston.info(`User logged in: ${email}`);
    res.json({ user: userObj, accessToken, refreshToken });
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
    const user = await User.findOne({ 
      'refreshTokens.token': hash,
      'refreshTokens.expiresAt': { $gt: new Date() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Remove old token
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== hash);

    const newAccessToken  = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    const expiresAt       = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    user.refreshTokens.push({ token: hashToken(newRefreshToken), expiresAt });
    await user.save();

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
      const hash = hashToken(token);
      await User.updateOne(
        { 'refreshTokens.token': hash },
        { $pull: { refreshTokens: { token: hash } } }
      );
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
