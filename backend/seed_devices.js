'use strict';

const mongoose = require('mongoose');
require('dotenv').config();
const Device = require('./src/models/Device');

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const devices = [
      { device_id: 'COLLAR_001', name: 'Elite Collar 1', status: 'free', type: 'collar' },
      { device_id: 'COLLAR_002', name: 'Elite Collar 2', status: 'free', type: 'collar' },
      { device_id: 'TAG_771', name: 'RFID Ear Tag 771', status: 'free', type: 'tag' },
      { device_id: 'TAG_992', name: 'RFID Ear Tag 992', status: 'free', type: 'tag' },
      { device_id: 'DRONE_PRO_1', name: 'Survey Drone Alpha', status: 'maintenance', type: 'drone' },
    ];

    console.log('Seeding devices...');
    for (const d of devices) {
      await Device.findOneAndUpdate(
        { device_id: d.device_id },
        d,
        { upsert: true, new: true }
      );
    }

    console.log('✅ Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
