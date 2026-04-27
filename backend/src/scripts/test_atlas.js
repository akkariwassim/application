'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  console.log('Connecting to:', process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@'));
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections found:', collections.map(c => c.name));
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR: Connection failed!');
    console.error(err.message);
    process.exit(1);
  }
}

test();
