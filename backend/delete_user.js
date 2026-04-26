'use strict';

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');

async function deleteUser(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const result = await User.deleteOne({ email });
    if (result.deletedCount > 0) {
      console.log(`Successfully deleted user: ${email}`);
    } else {
      console.log(`User not found: ${email}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

const emailToDelete = process.argv[2] || 'akkariwassim11@gmail.com';
deleteUser(emailToDelete);
