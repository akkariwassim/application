'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Farm = require('../models/Farm');
const Membership = require('../models/Membership');
const Animal = require('../models/Animal');
const Zone = require('../models/Zone');
const Alert = require('../models/Alert');
const HealthLog = require('../models/HealthLog');
const MovementHistory = require('../models/MovementHistory');

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const users = await User.find({});
    console.log(`Found ${users.length} users to migrate.`);

    for (const user of users) {
      console.log(`Processing user: ${user.email}`);

      // 1. Create Farm
      let farm = await Farm.findOne({ owner_id: user._id });
      if (!farm) {
        farm = await Farm.create({
          name: user.farm_name || `${user.name}'s Farm`,
          description: user.farm_description || '',
          location: {
            latitude: user.farm_latitude,
            longitude: user.farm_longitude,
          },
          owner_id: user._id,
          subscription_status: 'active'
        });
        console.log(`Created farm: ${farm.name}`);
      }

      // 2. Create Membership
      const membership = await Membership.findOneAndUpdate(
        { user_id: user._id, farm_id: farm._id },
        { role: 'owner', status: 'active' },
        { upsert: true, new: true }
      );
      console.log(`Created/Updated membership for ${user.email} as owner.`);

      // 3. Update Animals
      const animalResult = await Animal.updateMany(
        { user_id: user._id, farm_id: { $exists: false } },
        { $set: { farm_id: farm._id } }
      );
      console.log(`Updated ${animalResult.modifiedCount} animals.`);

      // 4. Update Zones
      const zoneResult = await Zone.updateMany(
        { user_id: user._id, farm_id: { $exists: false } },
        { $set: { farm_id: farm._id } }
      );
      console.log(`Updated ${zoneResult.modifiedCount} zones.`);

      // 5. Update Alerts
      const alertResult = await Alert.updateMany(
        { user_id: user._id, farm_id: { $exists: false } },
        { $set: { farm_id: farm._id } }
      );
      console.log(`Updated ${alertResult.modifiedCount} alerts.`);

      // 6. Update HealthLogs
      const healthResult = await HealthLog.updateMany(
        { user_id: user._id, farm_id: { $exists: false } },
        { $set: { farm_id: farm._id } }
      );
      console.log(`Updated ${healthResult.modifiedCount} health logs.`);

      // 7. Update MovementHistory
      const moveResult = await MovementHistory.updateMany(
        { user_id: user._id, farm_id: { $exists: false } },
        { $set: { farm_id: farm._id } }
      );
      console.log(`Updated ${moveResult.modifiedCount} movement logs.`);
      
      // Update User role if not already owner/admin
      if (!['owner', 'admin'].includes(user.role)) {
        user.role = 'owner';
        await user.save();
      }
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
