'use strict';

const Membership = require('../models/Membership');
const logger = require('../utils/logger');

/**
 * Middleware to enforce role-based access control at the farm level.
 * Requires the 'x-farm-id' header to be present.
 */
const checkRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const farmId = req.headers['x-farm-id'];
      
      if (!farmId) {
        // Global admin bypass
        if (req.user?.role === 'admin') return next();
        
        return res.status(400).json({ 
          success: false,
          error: 'FARM_ID_REQUIRED',
          message: 'L\'ID de la ferme est requis (x-farm-id).' 
        });
      }

      const membership = await Membership.findOne({
        user_id: req.user.id,
        farm_id: farmId,
        status: 'active'
      });

      if (!membership) {
        // Global admin bypass
        if (req.user?.role === 'admin') {
          req.farm_id = farmId;
          req.user_role = 'admin';
          return next();
        }

        logger.warn(`🚫 Unauthorized farm access: User ${req.user.email} tried to access farm ${farmId}`);
        return res.status(403).json({ 
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Vous n\'avez pas accès à cette ferme.' 
        });
      }

      // Check if role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        logger.warn(`🚫 Insufficient permissions: User ${req.user.email} (role: ${membership.role})`);
        return res.status(403).json({ 
          success: false,
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Permissions insuffisantes.' 
        });
      }

      // Attach farm info to request
      req.farm_id = farmId;
      req.user_role = membership.role;
      next();
    } catch (err) {
      logger.error(`Error in RBAC middleware: ${err.message}`);
      res.status(500).json({ 
        success: false,
        error: 'SERVER_ERROR',
        message: 'Erreur de vérification des permissions.' 
      });
    }
  };
};

module.exports = { checkRole };
