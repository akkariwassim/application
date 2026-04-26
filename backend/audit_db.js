'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

const User   = require('./src/models/User');
const Animal = require('./src/models/Animal');
const Zone   = require('./src/models/Zone');
const Device = require('./src/models/Device');
const Alert  = require('./src/models/Alert');

async function audit() {
  console.log('🚀 Starting Database Audit...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Audit Users
    const users = await User.find();
    console.log(`\n--- Users Audit (${users.length}) ---`);
    for (const user of users) {
      if (!user.email) console.warn(`⚠️ User ${user._id} has no email!`);
    }

    // 2. Audit Animals
    const animals = await Animal.find();
    console.log(`\n--- Animals Audit (${animals.length}) ---`);
    let orphanAnimals = 0;
    let brokenZones = 0;
    
    for (const animal of animals) {
      // Check User reference
      const userExists = await User.exists({ _id: animal.user_id });
      if (!userExists) {
        console.warn(`❌ Orphan Animal: ${animal.name} (${animal._id}) refers to non-existent User ${animal.user_id}`);
        orphanAnimals++;
      }

      // Check Zone reference
      if (animal.current_zone_id) {
        const zoneExists = await Zone.exists({ _id: animal.current_zone_id });
        if (!zoneExists) {
          console.warn(`⚠️ Broken Zone Ref: Animal ${animal.name} refers to non-existent Zone ${animal.current_zone_id}`);
          brokenZones++;
          // Optional: repair
          // await Animal.updateOne({ _id: animal._id }, { $set: { current_zone_id: null } });
        }
      }

      // Check coordinates
      if (isNaN(animal.latitude) || isNaN(animal.longitude)) {
        console.warn(`⚠️ Invalid Coords: Animal ${animal.name} has NaN coordinates`);
      }
    }

    // 3. Audit Devices
    const devices = await Device.find();
    console.log(`\n--- Devices Audit (${devices.length}) ---`);
    for (const device of devices) {
      if (device.status === 'assigned' && device.assigned_to_animal_id) {
        const animalExists = await Animal.exists({ _id: device.assigned_to_animal_id });
        if (!animalExists) {
          console.warn(`⚠️ Ghost Assignment: Device ${device.device_id} assigned to non-existent Animal ${device.assigned_to_animal_id}`);
          // Repair: await Device.updateOne({ _id: device._id }, { status: 'free', assigned_to_animal_id: null });
        }
      }
    }

    // 4. Audit Zones
    const zones = await Zone.find();
    console.log(`\n--- Zones Audit (${zones.length}) ---`);
    for (const zone of zones) {
      const userExists = await User.exists({ _id: zone.user_id });
      if (!userExists) console.warn(`❌ Orphan Zone: ${zone.name} refers to non-existent User ${zone.user_id}`);
    }

    console.log('\n--- Audit Summary ---');
    console.log(`Orphan Animals: ${orphanAnimals}`);
    console.log(`Broken Zone Refs: ${brokenZones}`);
    console.log('Audit Complete. Review warnings above.');

  } catch (err) {
    console.error('❌ Audit Failed:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

audit();
