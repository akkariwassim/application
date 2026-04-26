'use strict';

const User    = require('../models/User');
const bcrypt  = require('bcrypt');
const logger  = require('../utils/logger');

/**
 * Update user name
 * PUT /api/user/update-name
 */
async function updateName(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'INVALID_INPUT', 
        message: 'Le nom est obligatoire.' 
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name: name.trim() } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'USER_NOT_FOUND', 
        message: 'Utilisateur introuvable.' 
      });
    }

    logger.info(`User ${user.email} updated name to: ${user.name}`);
    res.json({ success: true, data: { user: user.toObject(), message: 'Nom mis à jour avec succès.' } });
  } catch (err) {
    logger.error(`Error in updateName: ${err.message}`);
    next(err);
  }
}

/**
 * Change user password
 * PUT /api/user/change-password
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'MISSING_FIELDS', 
        message: 'Tous les champs sont obligatoires.' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: 'INVALID_PASSWORD', 
        message: 'Le nouveau mot de passe doit faire au moins 6 caractères.' 
      });
    }

    // 1. Get user with password
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'USER_NOT_FOUND', 
        message: 'Utilisateur introuvable.' 
      });
    }

    // 2. Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      logger.warn(`Failed password change attempt for ${user.email}: incorrect current password`);
      return res.status(401).json({ 
        success: false,
        error: 'INCORRECT_PASSWORD', 
        message: 'L\'ancien mot de passe est incorrect.' 
      });
    }

    // 3. Update password (pre-save hook in User model will hash it)
    user.password = newPassword;
    
    // 4. Clear existing refresh tokens for security (optional but recommended on password change)
    user.refresh_tokens = [];
    
    await user.save();

    logger.info(`User ${user.email} successfully changed their password.`);
    res.json({ 
      success: true,
      data: { message: 'Mot de passe modifié avec succès. Veuillez vous reconnecter sur vos autres appareils.' } 
    });
  } catch (err) {
    logger.error(`Error in changePassword: ${err.message}`);
    next(err);
  }
}

/**
 * Update user phone number
 * PUT /api/user/update-phone
 */
async function updatePhone(req, res, next) {
  try {
    const { phone } = req.body;
    
    if (!phone || phone.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'INVALID_INPUT', 
        message: 'Le numéro de téléphone est obligatoire.' 
      });
    }

    // Basic digits validation (8 to 15 digits)
    const phoneRegex = /^[0-9+\s-]{8,15}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({ 
        success: false,
        error: 'INVALID_FORMAT', 
        message: 'Format de numéro invalide (ex: 0612345678).' 
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { phone: phone.trim() } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'USER_NOT_FOUND', 
        message: 'Utilisateur introuvable.' 
      });
    }

    logger.info(`User ${user.email} updated phone to: ${user.phone}`);
    res.json({ success: true, data: { user: user.toObject(), message: 'Numéro de téléphone mis à jour.' } });
  } catch (err) {
    logger.error(`Error in updatePhone: ${err.message}`);
    next(err);
  }
}

/**
 * Unified Profile Update
 * PUT /api/user/update-profile
 */
async function updateProfile(req, res, next) {
  try {
    const { name, email, phone, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'USER_NOT_FOUND', 
        message: 'Utilisateur introuvable.' 
      });
    }

    // 1. Update Basic Info
    if (name) user.name = name.trim();
    
    if (phone) {
      const phoneRegex = /^[0-9+\s-]{8,15}$/;
      if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({ 
          success: false,
          error: 'INVALID_PHONE', 
          message: 'Format de téléphone invalide.' 
        });
      }
      user.phone = phone.trim();
    }

    if (email) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ 
          success: false,
          error: 'INVALID_EMAIL', 
          message: 'Email invalide.' 
        });
      }
      user.email = email.trim().toLowerCase();
    }

    // 2. Update Password if requested
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ 
          success: false,
          error: 'MISSING_OLD_PASSWORD', 
          message: 'L\'ancien mot de passe est requis pour changer de mot de passe.' 
        });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ 
          success: false,
          error: 'INCORRECT_PASSWORD', 
          message: 'L\'ancien mot de passe est incorrect.' 
        });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ 
          success: false,
          error: 'SHORT_PASSWORD', 
          message: '6 caractères minimum pour le mot de passe.' 
        });
      }
      user.password = newPassword;
      user.refresh_tokens = []; // Revoke other sessions on password change
    }

    // 3. Update Farm Info
    const { farm_latitude, farm_longitude, farm_name } = req.body;
    if (farm_latitude !== undefined) user.farm_latitude = farm_latitude;
    if (farm_longitude !== undefined) user.farm_longitude = farm_longitude;
    if (farm_name !== undefined) user.farm_name = farm_name;

    // 4. Save (triggers pre-save hooks for hashing)
    await user.save();

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    logger.info(`Profile updated for user: ${user.email}`);
    res.json({ success: true, data: { user: userObj, message: 'Profil mis à jour avec succès.' } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: 'EMAIL_EXISTS', 
        message: 'Cet email est déjà utilisé.' 
      });
    }
    logger.error(`Error in updateProfile: ${err.message}`);
    next(err);
  }
}

/**
 * Update farm location and name
 * PUT /api/user/update-farm
 */
async function updateFarm(req, res, next) {
  try {
    const { latitude, longitude, name } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'USER_NOT_FOUND', 
        message: 'Utilisateur introuvable.' 
      });
    }

    if (latitude !== undefined) user.farm_latitude = latitude;
    if (longitude !== undefined) user.farm_longitude = longitude;
    if (name !== undefined) user.farm_name = name;

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    logger.info(`Farm updated for user: ${user.email}`);
    res.json({ success: true, data: { user: userObj, message: 'Ferme mise à jour avec succès.' } });
  } catch (err) {
    logger.error(`Error in updateFarm: ${err.message}`);
    next(err);
  }
}

/**
 * Diagnostic ping
 */
async function ping(req, res) {
  res.json({ success: true, message: 'User Router is active!', timestamp: new Date() });
}

module.exports = {
  updateName,
  changePassword,
  updatePhone,
  updateProfile,
  updateFarm,
  ping
};
