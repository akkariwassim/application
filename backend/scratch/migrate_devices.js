'use strict';

const mongoose = require('mongoose');
const path     = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Animal = require('../src/models/Animal');
const Device = require('../src/models/Device');

const migrate = async () => {
  try {
    console.log('🚀 Starting Device Migration...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const animals = await Animal.find({ device_id: { $ne: null } });
    console.log(`🔍 Found ${animals.length} animals with device assigned`);

    let createdCount = 0;
    for (const animal of animals) {
      if (!animal.device_id) continue;

      // Check if device already exists
      const existing = await Device.findOne({ device_id: animal.device_id });
      if (!existing) {
        await Device.create({
          device_id: animal.device_id,
          type: 'collar',
          status: 'assigned',
          last_sync: animal.last_sync || new Date()
        });
        createdCount++;
        console.log(`   + Registered device ${animal.device_id} for ${animal.name}`);
      }
    }

    console.log(`\n🎉 Migration Complete! Created ${createdCount} device records.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

migrate();
