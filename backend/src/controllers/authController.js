'use strict';

const User    = require('../models/User');
const jwt     = require('jsonwebtoken');
const logger  = require('../utils/logger');

// Helper to generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: userId }, 
    process.env.JWT_REFRESH_SECRET, 
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

/**
 * Register a new user
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone, role } = req.body;
    logger.debug(`Registration attempt: ${email}`, { name, phone, role });
    
    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      logger.warn(`Registration failed: Email already taken - ${email}`);
      return res.status(400).json({ 
        success: false,
        error: 'EMAIL_TAKEN', 
        message: 'Cet e-mail est déjà utilisé par un autre compte.' 
      });
    }
    
    const user = await User.create({
      name,
      email,
      password,
      phone: phone || '',
      role: role || 'farmer',
      is_active: true
    });
    
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Store refresh token in user document
    user.refresh_tokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    await user.save();

    logger.info(`✅ New user registered and logged in: ${email}`);
    
    res.status(201).json({ 
      success: true,
      data: {
        user, 
        accessToken, 
        refreshToken 
      }
    });
  } catch (err) {
    logger.error(`❌ Registration failed for ${req.body.email}: ${err.message}`);
    // If it's a Mongoose validation error, provide more detail
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        error: 'VALIDATION_ERROR', 
        message: Object.values(err.errors).map(e => e.message).join(', ') 
      });
    }
    next(err);
  }
}

/**
 * Login user
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    logger.debug(`Login attempt: ${email}`);
    
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logger.warn(`Login failed: User not found - ${email}`);
      return res.status(401).json({ 
        success: false,
        error: 'INVALID_CREDENTIALS', 
        message: 'Aucun compte trouvé avec cet e-mail.' 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn(`Login failed: Incorrect password - ${email}`);
      return res.status(401).json({ 
        success: false,
        error: 'INVALID_CREDENTIALS', 
        message: 'E-mail ou mot de passe incorrect.' 
      });
    }
    
    if (!user.is_active) {
      logger.warn(`Login failed: Account disabled - ${email}`);
      return res.status(403).json({ 
        success: false,
        error: 'ACCOUNT_DISABLED', 
        message: 'Votre compte est désactivé. Veuillez contacter l\'administrateur.' 
      });
    }
    
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Rotation: add new refresh token
    user.refresh_tokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    // Cleanup: remove expired or too many tokens (simple cleanup)
    if (user.refresh_tokens.length > 5) {
      user.refresh_tokens = user.refresh_tokens.slice(-5);
    }
    
    await user.save();

    logger.info(`✅ User logged in successfully: ${email}`);
    
    res.json({ 
      success: true,
      data: {
        user, 
        accessToken, 
        refreshToken 
      }
    });
  } catch (err) {
    logger.error(`Error in login: ${err.message}`);
    next(err);
  }
}

/**
 * GET current user /api/auth/me
 */
async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ 
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'Utilisateur non trouvé.' 
    });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: incomingToken } = req.body;
    if (!incomingToken) {
      return res.status(400).json({ 
        success: false,
        error: 'TOKEN_REQUIRED', 
        message: 'Token de rafraîchissement manquant.' 
      });
    }

    const decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.refresh_tokens.find(t => t.token === incomingToken)) {
      logger.warn(`Refresh failed: Token invalid or user not found - ${decoded.id}`);
      return res.status(401).json({ 
        success: false,
        error: 'INVALID_TOKEN', 
        message: 'Session expirée ou invalide.' 
      });
    }

    // Generate new pair
    const tokens = generateTokens(user._id);

    // Update tokens array (rotate)
    user.refresh_tokens = user.refresh_tokens.filter(t => t.token !== incomingToken);
    user.refresh_tokens.push({
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await user.save();

    logger.debug(`Session refreshed for user: ${user.email}`);
    res.json(tokens);
  } catch (err) {
    logger.error(`Error in refreshToken: ${err.message}`);
    res.status(401).json({ 
      success: false,
      error: 'INVALID_TOKEN', 
      message: 'Session expirée.' 
    });
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await User.updateOne(
        { 'refresh_tokens.token': refreshToken },
        { $pull: { refresh_tokens: { token: refreshToken } } }
      );
    }
    logger.info('User logged out');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    logger.error(`Error in logout: ${err.message}`);
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  refreshToken,
  logout
};
