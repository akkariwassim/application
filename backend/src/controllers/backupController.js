'use strict';

const Backup = require('../models/Backup');
const Animal = require('../models/Animal');
const Zone = require('../models/Zone');
const Alert = require('../models/Alert');
const Membership = require('../models/Membership');
const ActivityLog = require('../models/ActivityLog');
const logger = require('../utils/logger');

/**
 * Create a manual snapshot of the farm data
 */
async function createBackup(req, res, next) {
  try {
    const farmId = req.farm_id;
    const { name, type = 'manual' } = req.body;

    logger.info(`Creating backup for farm ${farmId}: ${name}`);

    // Collect all data for this farm
    const animals = await Animal.find({ farm_id: farmId });
    const zones = await Zone.find({ farm_id: farmId });
    const alerts = await Alert.find({ farm_id: farmId });
    const memberships = await Membership.find({ farm_id: farmId });

    const snapshotData = {
      animals,
      zones,
      alerts,
      memberships,
      timestamp: new Date().toISOString()
    };

    const backup = await Backup.create({
      farm_id: farmId,
      name: name || `Backup ${new Date().toLocaleDateString()}`,
      type,
      data: snapshotData,
      created_by: req.user.id,
      size_bytes: Buffer.byteLength(JSON.stringify(snapshotData)),
      status: 'completed'
    });

    // Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      farm_id: farmId,
      action: 'CREATE_BACKUP',
      entity_type: 'Backup',
      entity_id: backup._id
    });

    res.status(201).json({ success: true, data: backup });
  } catch (err) {
    logger.error(`Backup creation failed: ${err.message}`);
    next(err);
  }
}

/**
 * List all backups for a farm
 */
async function listBackups(req, res, next) {
  try {
    const backups = await Backup.find({ farm_id: req.farm_id })
      .select('-data') // Don't return the huge data object in the list
      .sort({ created_at: -1 });
    
    res.json({ success: true, data: backups });
  } catch (err) {
    next(err);
  }
}

/**
 * Restore data from a backup point
 */
async function restoreBackup(req, res, next) {
  try {
    const { backupId } = req.params;
    const farmId = req.farm_id;

    const backup = await Backup.findOne({ _id: backupId, farm_id: farmId });
    if (!backup) {
      return res.status(404).json({ success: false, message: 'Sauvegarde non trouvée.' });
    }

    const { animals, zones, alerts } = backup.data;

    logger.info(`Restoring farm ${farmId} from backup ${backupId}`);

    // Simple restoration strategy: Delete current and insert backup data
    // WARNING: In production, we might want a more sophisticated merge or soft-delete
    
    // 1. Delete current data
    await Animal.deleteMany({ farm_id: farmId });
    await Zone.deleteMany({ farm_id: farmId });
    await Alert.deleteMany({ farm_id: farmId });

    // 2. Restore data
    if (animals && animals.length > 0) {
      // Re-map IDs if necessary or just insert as is (be careful with existing refs)
      await Animal.insertMany(animals);
    }
    if (zones && zones.length > 0) {
      await Zone.insertMany(zones);
    }
    if (alerts && alerts.length > 0) {
      await Alert.insertMany(alerts);
    }

    backup.status = 'restored';
    await backup.save();

    // Log activity
    await ActivityLog.create({
      user_id: req.user.id,
      farm_id: farmId,
      action: 'RESTORE_BACKUP',
      entity_type: 'Backup',
      entity_id: backupId
    });

    res.json({ success: true, message: 'Ferme restaurée avec succès à partir de la sauvegarde.' });
  } catch (err) {
    logger.error(`Restore failed: ${err.message}`);
    next(err);
  }
}

/**
 * Delete a backup
 */
async function deleteBackup(req, res, next) {
  try {
    const { backupId } = req.params;
    await Backup.deleteOne({ _id: backupId, farm_id: req.farm_id });
    res.json({ success: true, message: 'Sauvegarde supprimée.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup
};
