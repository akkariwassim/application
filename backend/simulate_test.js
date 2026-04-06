'use strict';
const axios = require('axios');
const jwt   = require('jsonwebtoken');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';

// Generate a valid token for simulation (as farmer #1)
const token = jwt.sign({ id: 1, email: 'farmer@example.com' }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });

const ANIMAL_ID = 1; // Bessie
const INSIDE_COORDS  = { latitude: 35.038, longitude: 9.484 };
const OUTSIDE_COORDS = { latitude: 35.050, longitude: 9.500 };

async function simulate(scenario, data) {
  console.log(`\n🧪 Scenario: ${scenario}`);
  try {
    const response = await axios.post(`${API_URL}/positions`, {
      animalId: ANIMAL_ID,
      ...data,
      timestamp: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
  }
}

async function runAll() {
  console.log('🚀 Starting System Simulation...');

  // 1. Normal State
  await simulate('Normal - Inside zone, healthy metrics', {
    ...INSIDE_COORDS,
    temperature: 38.5,
    activity: 45
  });

  // 2. High Temperature Alert
  console.log('\n(Wait 3s for next update...)');
  await new Promise(r => setTimeout(r, 3000));
  await simulate('Fever Alert - Inside zone, High temperature', {
    ...INSIDE_COORDS,
    temperature: 41.2,
    activity: 25
  });

  // 3. Geofence Breach Alert
  console.log('\n(Wait 3s for next update...)');
  await new Promise(r => setTimeout(r, 3000));
  await simulate('Geofence Breach - Outside zone', {
    ...OUTSIDE_COORDS,
    temperature: 38.8,
    activity: 60
  });

  console.log('\n🏁 Simulation Complete. Check your Mobile App (Animals Dashboard & Alerts tab)!');
}

runAll();
