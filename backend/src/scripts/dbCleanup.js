'use strict';

const mongoose = require('mongoose');
require('dotenv').config();
const Animal = require('../models/Animal');
const Device = require('../models/Device');
const logger = require('../utils/logger');
const connectDB = require('../config/mongoose');

async function cleanup() {
  await connectDB();
  logger.info('--- Starting Database Audit & Cleanup ---');

  try {
    // 1. Audit Animals for Duplicate Devices/RFID
    const animals = await Animal.find({});
    const deviceMap = new Map();
    const rfidMap = new Map();
    const toDelete = [];

    for (const animal of animals) {
      if (animal.device_id) {
        if (deviceMap.has(animal.device_id)) {
          logger.warn(`Duplicate device_id [${animal.device_id}] found on animal: ${animal.name}. Marking for cleanup.`);
          toDelete.push(animal._id);
        } else {
          deviceMap.set(animal.device_id, animal._id);
        }
      }

      if (animal.rfid_tag) {
        if (rfidMap.has(animal.rfid_tag)) {
          logger.warn(`Duplicate rfid_tag [${animal.rfid_tag}] found on animal: ${animal.name}. Marking for cleanup.`);
          toDelete.push(animal._id);
        } else {
          rfidMap.set(animal.rfid_tag, animal._id);
        }
      }
    }

    if (toDelete.length > 0) {
      logger.info(`Cleaning up ${toDelete.length} duplicate animal records...`);
      await Animal.deleteMany({ _id: { $in: toDelete } });
    } else {
      logger.info('✅ No duplicate animal identifiers found.');
    }

    // 2. Audit Devices vs Assignments
    const devices = await Device.find({});
    for (const device of devices) {
      if (device.status === 'assigned' && device.assigned_to_animal_id) {
        const linkedAnimal = await Animal.findById(device.assigned_to_animal_id);
        if (!linkedAnimal) {
          logger.warn(`Device ${device.device_id} is assigned to non-existent animal ${device.assigned_to_animal_id}. Resetting status to free.`);
          device.status = 'free';
          device.assigned_to_animal_id = null;
          await device.save();
        }
      }
    }

    // 3. Re-index
    logger.info('Re-syncing indexes...');
    await Animal.syncIndexes();
    await Device.syncIndexes();

    logger.info('✅ Database audit and cleanup completed successfully.');
    process.exit(0);
  } catch (err) {
    logger.error(`❌ Cleanup failed: ${err.message}`);
    process.exit(1);
  }
}

cleanup();
