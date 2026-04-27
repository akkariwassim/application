'use strict';

const Membership = require('../models/Membership');
const logger = require('../utils/logger');

/**
 * Middleware to enforce role-based access control at the farm level.
 * Requires the 'x-farm-id' header to be present.
<<<<<<< HEAD
=======
 * 
 * @param {Array} allowedRoles - List of roles that are allowed to access the route.
>>>>>>> origin/main
 */
const checkRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const farmId = req.headers['x-farm-id'];
      
      if (!farmId) {
<<<<<<< HEAD
        // Global admin bypass
        if (req.user?.role === 'admin') return next();
        
=======
        // If it's an admin, we might allow bypass if they are doing system-wide management
        if (req.user?.role === 'admin') {
          return next();
        }
>>>>>>> origin/main
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
<<<<<<< HEAD
        // Global admin bypass
=======
        // If the user is a global admin, they can access any farm
>>>>>>> origin/main
        if (req.user?.role === 'admin') {
          req.farm_id = farmId;
          req.user_role = 'admin';
          return next();
        }

<<<<<<< HEAD
        logger.warn(`🚫 Unauthorized farm access: User ${req.user.email} tried to access farm ${farmId}`);
=======
        logger.warn(`🚫 Unauthorized farm access: User ${req.user.email} (${req.user.id}) tried to access farm ${farmId}. No active membership found.`);
>>>>>>> origin/main
        return res.status(403).json({ 
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Vous n\'avez pas accès à cette ferme.' 
        });
      }

      // Check if role is allowed
      if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
<<<<<<< HEAD
        logger.warn(`🚫 Insufficient permissions: User ${req.user.email} (role: ${membership.role})`);
        return res.status(403).json({ 
          success: false,
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Permissions insuffisantes.' 
=======
        logger.warn(`Insufficient permissions: User ${req.user.id} (role: ${membership.role}) tried to access protected route for roles: ${allowedRoles.join(', ')}`);
        return res.status(403).json({ 
          success: false,
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.' 
>>>>>>> origin/main
        });
      }

      // Attach farm info to request
      req.farm_id = farmId;
      req.user_role = membership.role;
      next();
    } catch (err) {
<<<<<<< HEAD
      logger.error(`Error in RBAC middleware: ${err.message}`);
      res.status(500).json({ 
        success: false,
        error: 'SERVER_ERROR',
        message: 'Erreur de vérification des permissions.' 
=======
      logger.error(`Error in checkRole middleware: ${err.message}`);
      res.status(500).json({ 
        success: false,
        error: 'SERVER_ERROR',
        message: 'Erreur lors de la vérification des permissions.' 
>>>>>>> origin/main
      });
    }
  };
};

module.exports = { checkRole };
