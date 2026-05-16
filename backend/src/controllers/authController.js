'use strict';

const User       = require('../models/User');
const Farm       = require('../models/Farm');
const Membership = require('../models/Membership');
const jwt        = require('jsonwebtoken');
const logger     = require('../utils/logger');
const response   = require('../utils/responseHelper');

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
      return response.error(res, 'Cet e-mail est déjà utilisé par un autre compte.', 400, 'EMAIL_TAKEN');
    }
    
    const user = await User.create({
      name,
      email,
      password,
      phone: phone || '',
      role: role || 'owner',
      is_active: true
    });

    // ── Auto-create Farm and Membership ──
    // This ensures new users aren't blocked by RBAC (403 Forbidden)
    const farm = await Farm.create({
      name: `${user.name}'s Farm`,
      owner_id: user._id,
      description: 'Default farm created on registration',
      subscription_status: 'trial'
    });

    await Membership.create({
      user_id: user._id,
      farm_id: farm._id,
      role: 'owner',
      status: 'active'
    });
    
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Store refresh token in user document
    user.refresh_tokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    await user.save();

    logger.info(`✅ New user registered with farm: ${farm.name} (${email})`);
    
    return response.success(res, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      farmId: farm._id,
      accessToken,
      refreshToken
    }, 201);
  } catch (err) {
    logger.error(`❌ Registration failed for ${req.body.email}: ${err.message}`);
    // If it's a Mongoose validation error, provide more detail
    if (err.name === 'ValidationError') {
      return response.error(res, Object.values(err.errors).map(e => e.message).join(', '), 400, 'VALIDATION_ERROR');
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
      return response.error(res, 'Aucun compte trouvé avec cet e-mail.', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn(`Login failed: Incorrect password - ${email}`);
      return response.error(res, 'E-mail ou mot de passe incorrect.', 401, 'INVALID_CREDENTIALS');
    }
    
    if (!user.is_active) {
      logger.warn(`Login failed: Account disabled - ${email}`);
      return response.error(res, 'Votre compte est désactivé. Veuillez contacter l\'administrateur.', 403, 'ACCOUNT_DISABLED');
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
    
    // Fetch memberships to provide a default farm context
    let primaryMembership = await Membership.findOne({ user_id: user._id }).sort({ created_at: 1 });

    if (!primaryMembership) {
      logger.info(`🏗️ [Legacy Migration] Creating default farm for user ${user.email}`);
      const farm = await Farm.create({
        name: `${user.name}'s Farm`,
        owner_id: user._id
      });
      primaryMembership = await Membership.create({
        user_id: user._id,
        farm_id: farm._id,
        role: 'owner'
      });
    }

    return response.success(res, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }, 
      farmId: primaryMembership ? primaryMembership.farm_id : null,
      accessToken, 
      refreshToken 
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
    if (!user) return response.error(res, 'Utilisateur non trouvé.', 404, 'USER_NOT_FOUND');

    const Membership = require('../models/Membership');
    const Farm = require('../models/Farm');
    let memberships = await Membership.find({ user_id: user._id });

    if (memberships.length === 0) {
      logger.info(`🏗️ [Legacy Migration] Creating default farm for user ${user.email} (via getMe)`);
      const farm = await Farm.create({
        name: `${user.name}'s Farm`,
        owner_id: user._id
      });
      const membership = await Membership.create({
        user_id: user._id,
        farm_id: farm._id,
        role: 'owner'
      });
      memberships = [membership];
    }

    return response.success(res, {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      memberships
    });
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
      return response.error(res, 'Token de rafraîchissement manquant.', 400, 'TOKEN_REQUIRED');
    }

    const decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.refresh_tokens.find(t => t.token === incomingToken)) {
      logger.warn(`Refresh failed: Token invalid or user not found - ${decoded.id}`);
      return response.error(res, 'Session expirée ou invalide.', 401, 'INVALID_TOKEN');
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
    return response.success(res, tokens);
  } catch (err) {
    logger.error(`Error in refreshToken: ${err.message}`);
    return response.error(res, 'Session expirée.', 401, 'INVALID_TOKEN');
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
    return response.success(res, { message: 'Logged out successfully' });
  } catch (err) {
    logger.error(`Error in logout: ${err.message}`);
    next(err);
  }
}

/**
 * POST /api/auth/forgot-password
 * Sends a password reset link (simulated)
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists for security
      return response.success(res, { message: 'Si cet e-mail existe dans notre système, un lien de réinitialisation sera envoyé.' });
    }

    // Generate a simple token (in production use crypto.randomBytes)
    const resetToken = jwt.sign(
      { id: user._id, purpose: 'password_reset' }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' }
    );

    // TODO: Send real email
    logger.info(`[SIMULATION] Password reset email for ${email}:`);
    logger.info(`[SIMULATION] Link: http://localhost:3000/reset-password?token=${resetToken}`);

    return response.success(res, { message: 'Si cet e-mail existe dans notre système, un lien de réinitialisation sera envoyé.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/reset-password
 * Updates password using a reset token
 */
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return response.error(res, 'Token et nouveau mot de passe requis.', 400, 'MISSING_FIELDS');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== 'password_reset') {
      throw new Error('Invalid token purpose');
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return response.error(res, 'Utilisateur non trouvé.', 404, 'USER_NOT_FOUND');
    }

    user.password = newPassword;
    user.refresh_tokens = []; // Log out from all devices
    await user.save();

    logger.info(`Password reset successful for user: ${user.email}`);
    return response.success(res, { message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) {
    logger.error(`Reset password failed: ${err.message}`);
    return response.error(res, 'Lien de réinitialisation invalide ou expiré.', 401, 'INVALID_TOKEN');
  }
}

module.exports = {
  register,
  login,
  getMe,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword
};
