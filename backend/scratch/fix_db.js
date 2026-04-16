const mongoose = require('mongoose');
require('dotenv').config();

const fix = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    // Fix Device IDs that are empty strings
    const resId = await mongoose.connection.db.collection('animals').updateMany(
      { device_id: '' },
      { $set: { device_id: null } }
    );
    console.log(`Updated ${resId.modifiedCount} animal device IDs from "" to null`);

    // Fix RFID tags that are empty strings
    const resRfid = await mongoose.connection.db.collection('animals').updateMany(
      { rfid_tag: '' },
      { $set: { rfid_tag: null } }
    );
    console.log(`Updated ${resRfid.modifiedCount} animal RFID tags from "" to null`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fix();
