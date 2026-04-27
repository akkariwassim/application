'use strict';

const router = require('express').Router();
const membershipCtrl = require('../controllers/membershipController');
const activityCtrl   = require('../controllers/activityController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

// All membership routes require authentication
router.use(authenticate);

// List my memberships (cross-farm)
router.get('/my', membershipCtrl.getMyMemberships);

// List members (any active member can see the team)
router.get('/', checkRole([]), membershipCtrl.listMembers);

// List activity logs (only owners and admins)
router.get('/logs', checkRole(['owner', 'admin']), activityCtrl.listLogs);

// Invite member (only owners and admins)
router.post('/invite', checkRole(['owner', 'admin']), membershipCtrl.inviteMember);

// Update role (only owners and admins)
router.put('/:membershipId/role', checkRole(['owner', 'admin']), membershipCtrl.updateMemberRole);

// Remove member (only owners and admins)
router.delete('/:membershipId', checkRole(['owner', 'admin']), membershipCtrl.removeMember);

module.exports = router;
