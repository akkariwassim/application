'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/backupController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

// All backup routes require authentication
router.use(authenticate);

// List backups
router.get('/', checkRole(['owner', 'admin']), ctrl.listBackups);

// Create backup
router.post('/', checkRole(['owner', 'admin']), ctrl.createBackup);

// Restore backup (Owner only for high-risk action)
router.post('/:backupId/restore', checkRole(['owner']), ctrl.restoreBackup);

// Delete backup
router.delete('/:backupId', checkRole(['owner', 'admin']), ctrl.deleteBackup);

module.exports = router;
