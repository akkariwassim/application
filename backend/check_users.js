'use strict';

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const users = await User.find({}, 'name email role created_at');
    console.log('Users in database:');
    console.table(users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      created: u.created_at
    })));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkUsers();
