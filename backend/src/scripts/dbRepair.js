'use strict';

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Animal = require('../models/Animal');
const Device = require('../models/Device');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/smart_fence';

async function repairDB() {
  try {
    console.log('--- Database Repair Starting ---');
    console.log(`Connecting to: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const animals = await Animal.find({ device_id: { $ne: null, $exists: true } }).lean();
    console.log(`Found ${animals.length} animals with assigned device IDs.`);

    let repairedCount = 0;
    let existingCount = 0;

    for (const animal of animals) {
      const devId = animal.device_id.trim();
      if (!devId) continue;

      // Check if device exists
      let device = await Device.findOne({ device_id: devId });

      if (!device) {
        console.log(`[REPAIR] Registering missing device: ${devId} for animal: ${animal.name}`);
        await Device.create({
          device_id: devId,
          type: 'collar', // Default
          status: 'assigned',
          assigned_to_animal_id: animal._id,
          battery_level: animal.battery_level || 100,
          last_sync: animal.last_seen || new Date()
        });
        repairedCount++;
      } else {
        // Device exists. Ensure it's correctly linked and status is 'assigned'
        let updated = false;
        if (device.status !== 'assigned') {
          device.status = 'assigned';
          updated = true;
        }
        if (String(device.assigned_to_animal_id) !== String(animal._id)) {
          device.assigned_to_animal_id = animal._id;
          updated = true;
        }

        if (updated) {
          await device.save();
          console.log(`[SYNC] Updated device ${devId} status to 'assigned' for animal ${animal.name}`);
        }
        existingCount++;
      }
    }

    console.log(`\n--- Repair Complete ---`);
    console.log(`New Devices Created: ${repairedCount}`);
    console.log(`Existing Devices Synced: ${existingCount}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Repair failed:', err);
    process.exit(1);
  }
}

repairDB();
