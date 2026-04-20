'use strict';

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Animal = require('../models/Animal');
const Device = require('../models/Device');
const Zone = require('../models/Zone');
const Alert = require('../models/Alert');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_fence';

async function auditDB() {
  try {
    console.log('--- Database Audit Starting ---');
    console.log(`Connecting to: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const report = {
      counts: {},
      orphans: {},
      duplicates: {},
      inconsistencies: []
    };

    // 1. Counts
    report.counts.users = await User.countDocuments();
    report.counts.animals = await Animal.countDocuments();
    report.counts.devices = await Device.countDocuments();
    report.counts.zones = await Zone.countDocuments();
    report.counts.alerts = await Alert.countDocuments();

    console.log('Collection Counts:', JSON.stringify(report.counts, null, 2));

    // 2. Identify Orphans (Animals without Users)
    const animals = await Animal.find().lean();
    report.orphans.animalsNoUser = 0;
    for (const animal of animals) {
      const userExists = await User.exists({ _id: animal.user_id });
      if (!userExists) {
        report.orphans.animalsNoUser++;
        report.inconsistencies.push({ type: 'ORPHAN_ANIMAL', id: animal._id, user_id: animal.user_id, name: animal.name });
      }
    }

    // 3. Identify Orphans (Zones without Users)
    const zones = await Zone.find().lean();
    report.orphans.zonesNoUser = 0;
    for (const zone of zones) {
      const userExists = await User.exists({ _id: zone.user_id });
      if (!userExists) {
        report.orphans.zonesNoUser++;
        report.inconsistencies.push({ type: 'ORPHAN_ZONE', id: zone._id, name: zone.name });
      }
    }

    // 4. Device Integrity
    const devices = await Device.find().lean();
    report.orphans.devicesBrokenAssignment = 0;
    for (const dev of devices) {
      if (dev.assigned_to_animal_id) {
        const animalExists = await Animal.exists({ _id: dev.assigned_to_animal_id });
        if (!animalExists) {
          report.orphans.devicesBrokenAssignment++;
          report.inconsistencies.push({ type: 'BROKEN_DEVICE_ASSIGNMENT', id: dev._id, device_id: dev.device_id, animal_id: dev.assigned_to_animal_id });
        }
      }
    }

    // 5. Cross-check Animal Device Status
    for (const animal of animals) {
      if (animal.device_id) {
        const device = await Device.findOne({ device_id: animal.device_id });
        if (!device) {
          report.inconsistencies.push({ type: 'ANIMAL_MISSING_DEVICE_RECORD', id: animal._id, name: animal.name, device_id: animal.device_id });
        } else if (device.status !== 'assigned' || String(device.assigned_to_animal_id) !== String(animal._id)) {
          report.inconsistencies.push({ 
            type: 'DEVICE_STATUS_MISMATCH', 
            animal_id: animal._id, 
            device_id: animal.device_id, 
            device_status: device.status,
            assigned_to: device.assigned_to_animal_id 
          });
        }
      }
    }

    console.log('\n--- Inconsistency Summary ---');
    console.log(`Orphan Animals: ${report.orphans.animalsNoUser}`);
    console.log(`Orphan Zones: ${report.orphans.zonesNoUser}`);
    console.log(`Broken Device Assignments: ${report.orphans.devicesBrokenAssignment}`);
    console.log(`Other Inconsistencies: ${report.inconsistencies.length}`);

    if (report.inconsistencies.length > 0) {
      console.log('\nDetailed Inconsistencies (First 10):');
      console.log(JSON.stringify(report.inconsistencies.slice(0, 10), null, 2));
    }

    console.log('\n--- Audit Complete ---');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  }
}

auditDB();
