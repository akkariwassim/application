'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Animal = require('../models/Animal');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

async function simulate() {
  console.log('📡 Starting Live Data Simulation...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find a user to get a token
    const user = await User.findOne({ email: /@/ });
    if (!user) {
      console.error('❌ No user found to simulate for.');
      process.exit(1);
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const API_URL = `http://localhost:${process.env.PORT || 3000}/api`;

    // Find all animals for this user
    const animals = await Animal.find({ user_id: user._id });
    if (animals.length === 0) {
      console.log('ℹ️ No animals found. Create some in the app first.');
      process.exit(0);
    }

    console.log(`🐄 Simulating for ${animals.length} animals...`);

    // Simulation Loop
    setInterval(async () => {
      for (const animal of animals) {
        // Random walk simulation
        const latDelta = (Math.random() - 0.5) * 0.0001;
        const lonDelta = (Math.random() - 0.5) * 0.0001;
        
        const newLat = parseFloat(animal.latitude) + latDelta;
        const newLon = parseFloat(animal.longitude) + lonDelta;
        
        // Random health data
        const heartRate = 60 + Math.floor(Math.random() * 40); // 60-100 BPM
        const temp = 38 + Math.random(); // 38-39 C
        const battery = Math.max(0, Math.min(100, (animal.battery_level || 100) - (Math.random() * 0.1)));
        const activity = Math.floor(Math.random() * 100);

        try {
          await axios.post(`${API_URL}/positions`, {
            animalId: animal._id,
            latitude: newLat,
            longitude: newLon,
            temperature: temp,
            heart_rate: heartRate,
            battery_level: Math.floor(battery),
            gps_signal: 95 + Math.floor(Math.random() * 5),
            activity
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          // Update local object to keep track of battery/position drift
          animal.latitude = newLat;
          animal.longitude = newLon;
          animal.battery_level = battery;
          
          console.log(`✅ Update sent for ${animal.name}: ${heartRate} BPM, ${temp.toFixed(1)}°C`);
        } catch (err) {
          console.error(`❌ Failed to update ${animal.name}:`, err.message);
        }
      }
    }, 5000); // Every 5 seconds

  } catch (err) {
    console.error('❌ Simulation Error:', err);
  }
}

simulate();
