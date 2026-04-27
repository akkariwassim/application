'use strict';

const Membership = require('../models/Membership');
const User = require('../models/User');
const Farm = require('../models/Farm');
const ActivityLog = require('../models/ActivityLog');
const logger = require('../utils/logger');

/**
 * List all memberships for the current user (across all farms)
 */
async function getMyMemberships(req, res, next) {
  try {
    const memberships = await Membership.find({ user_id: req.user.id, status: 'active' })
      .populate('farm_id')
      .sort({ created_at: -1 });
    
    res.json({ success: true, data: memberships });
  } catch (err) {
    next(err);
  }
}

/**
 * List all members of a farm
 */
async function listMembers(req, res, next) {
  try {
    const members = await Membership.find({ farm_id: req.farm_id })
      .populate('user_id', 'name email phone role')
      .sort({ created_at: 1 });
    
    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
}

/**
 * Invite/Add a user to the farm
 */
async function inviteMember(req, res, next) {
  try {
    const { email, role } = req.body;
    const farmId = req.farm_id;

    logger.info(`Inviting member: ${email} to farm ${farmId} with role ${role}`);

    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé. Ils doivent d\'abord créer un compte.' 
      });
    }

    // Check if already a member
    const existing = await Membership.findOne({ user_id: user._id, farm_id: farmId });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cet utilisateur est déjà membre de cette ferme.' 
      });
    }

    const membership = await Membership.create({
      user_id: user._id,
      farm_id: farmId,
      role: role || 'worker',
      status: 'active', // For now, direct add
      invited_by: req.user.id
    });

    // Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      farm_id: farmId,
      action: 'INVITE_MEMBER',
      entity_type: 'User',
      entity_id: user._id,
      details: { email, role }
    });

    res.status(201).json({ success: true, data: membership });
  } catch (err) {
    next(err);
  }
}

/**
 * Update member role
 */
async function updateMemberRole(req, res, next) {
  try {
    const { membershipId } = req.params;
    const { role } = req.body;

    const membership = await Membership.findOne({ _id: membershipId, farm_id: req.farm_id });
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Membre non trouvé.' });
    }

    // Cannot change owner's role easily or if it's the last owner
    if (membership.role === 'owner' && role !== 'owner') {
      const ownersCount = await Membership.countDocuments({ farm_id: req.farm_id, role: 'owner' });
      if (ownersCount <= 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Impossible de changer le rôle du dernier propriétaire.' 
        });
      }
    }

    membership.role = role;
    await membership.save();

    // Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      farm_id: req.farm_id,
      action: 'UPDATE_ROLE',
      entity_type: 'Membership',
      entity_id: membership._id,
      details: { role }
    });

    res.json({ success: true, data: membership });
  } catch (err) {
    next(err);
  }
}

/**
 * Remove member from farm
 */
async function removeMember(req, res, next) {
  try {
    const { membershipId } = req.params;

    const membership = await Membership.findOne({ _id: membershipId, farm_id: req.farm_id });
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Membre non trouvé.' });
    }

    if (membership.role === 'owner') {
      const ownersCount = await Membership.countDocuments({ farm_id: req.farm_id, role: 'owner' });
      if (ownersCount <= 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Impossible de supprimer le dernier propriétaire.' 
        });
      }
    }

    await Membership.deleteOne({ _id: membershipId });

    // Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      farm_id: req.farm_id,
      action: 'REMOVE_MEMBER',
      entity_type: 'Membership',
      entity_id: membershipId
    });

    res.json({ success: true, message: 'Membre supprimé avec succès.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyMemberships,
  listMembers,
  inviteMember,
  updateMemberRole,
  removeMember
};
