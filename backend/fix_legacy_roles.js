'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function fixRoles() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const result = await User.updateMany(
      { role: 'farmer' },
      { $set: { role: 'owner' } }
    );

    console.log(`Updated ${result.modifiedCount} users from 'farmer' to 'owner'.`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to fix roles:', err);
    process.exit(1);
  }
}

fixRoles();
