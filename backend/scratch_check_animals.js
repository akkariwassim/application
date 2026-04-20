const mongoose = require('mongoose');
require('dotenv').config();
const Animal = require('./src/models/Animal');

async function checkDuplicates() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const animals = await Animal.find({ device_id: { $ne: null } });
  console.log(`Found ${animals.length} animals with device_id:`);
  animals.forEach(a => {
    console.log(`- ID: ${a._id}, Name: ${a.name}, DeviceID: ${a.device_id}, RFID: ${a.rfid_tag}`);
  });

  process.exit(0);
}

checkDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
