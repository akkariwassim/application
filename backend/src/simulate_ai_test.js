'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const Animal = require('./models/Animal');
const Zone = require('./models/Zone');
const User = require('./models/User');

async function simulate() {
  try {
    console.log('🚀 Starting Live AI Simulation with AUTH Header...');
    
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to Database');

    // 1. Find an animal to simulate
    const animal = await Animal.findOne({ device_id: { $ne: null } });
    if (!animal) {
      console.error('❌ No animal with a device ID found to simulate.');
      process.exit(1);
    }
    console.log(`📡 Targeting Animal: ${animal.name} (ID: ${animal._id}, Device: ${animal.device_id})`);

    // 2. Find the owner to generate a token
    const user = await User.findById(animal.user_id);
    if (!user) {
      console.error('❌ Animal owner not found.');
      process.exit(1);
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_PRODUCTION_SECRET_32_CHARS';
    const accessToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    console.log(`🔑 Generated Simulation Token for User: ${user.email}`);

    // 3. Find its assigned zone or a primary zone
    const zone = await Zone.findOne({ _id: animal.current_zone_id }) || await Zone.findOne({ is_primary: 1 });
    if (!zone) {
      console.warn('⚠️ No zone found. Geofencing simulation will be limited.');
    } else {
      console.log(`📍 Using Zone: ${zone.name} (Type: ${zone.zone_type})`);
    }

    const API_URL = 'http://localhost:3000/api/positions';

    // ── STEP 1: Inside Zone (Healthy) ──
    console.log('\n--- SESSION 1: Normal In-Zone Location ---');
    let lat = zone ? (zone.center?.coordinates[1] || 48.8) : 48.8;
    let lon = zone ? (zone.center?.coordinates[0] || 2.3) : 2.3;
    
    await postUpdate(API_URL, accessToken, {
      animalId: animal._id.toString(),
      deviceId: animal.device_id,
      latitude: lat,
      longitude: lon,
      temperature: 38.2,
      heart_rate: 75,
      battery_level: 95
    });

    // ── STEP 2: Outside Zone (Breach) ──
    console.log('\n--- SESSION 2: Geofence Breach Escape ---');
    await postUpdate(API_URL, accessToken, {
      animalId: animal._id.toString(),
      deviceId: animal.device_id,
      latitude: lat + 0.05, // 5km away
      longitude: lon + 0.05,
      temperature: 38.5,
      heart_rate: 90,
      battery_level: 94
    });

    // ── STEP 3: Critical Health (AI Alert) ──
    console.log('\n--- SESSION 3: Critical Health Fever ---');
    await postUpdate(API_URL, accessToken, {
      animalId: animal._id.toString(),
      deviceId: animal.device_id,
      latitude: lat,
      longitude: lon,
      temperature: 41.5, // Fever
      heart_rate: 130, // High BPM
      activity: 5, // Very low activity (laying down/critical)
      battery_level: 92
    });

    console.log('\n✅ Simulation Complete. Alerts and Geofence Breaches were triggered if logic holds.');
    process.exit(0);

  } catch (err) {
    console.error('❌ Simulation Failed:', err.stack);
    process.exit(1);
  }
}

async function postUpdate(url, token, payload) {
  try {
    console.log(`📤 Sending IoT Payload: Lat:${payload.latitude.toFixed(4)}, Temp:${payload.temperature}°C`);
    const res = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`📥 Response: ${res.data.success ? 'SUCCESS' : 'FAILED'} - Status: ${res.data.data?.status || 'unknown'}`);
    
    // Check if alerts were created in DB specifically for this session
    const Alert = require('./models/Alert');
    const recentAlerts = await Alert.find({ animal_id: payload.animalId }).sort({ created_at: -1 }).limit(1);
    if (recentAlerts.length > 0 && (Date.now() - recentAlerts[0].created_at.getTime() < 5000)) {
      console.log(`🚨 REAL-TIME ALERT CREATED: [${recentAlerts[0].type}] - ${recentAlerts[0].message}`);
    }

  } catch (err) {
    console.error(`❌ Request Error: ${err.message}`);
    if (err.response) {
      console.error(`   API Details: ${JSON.stringify(err.response.data)}`);
    }
  }
}

simulate();
