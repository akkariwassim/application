'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const AIPrediction = require('./models/AIPrediction');
const Alert = require('./models/Alert');

async function check() {
  try {
    console.log('🔍 Checking E2E results in MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const animalId = '69e3c3edc0fe7f100abc355b'; // Rayen
    
    console.log('\n--- AI PREDICTIONS ---');
    const predictions = await AIPrediction.find({ animal_id: animalId })
      .sort({ created_at: -1 })
      .limit(3);
    
    if (predictions.length === 0) {
      console.log('❌ No AI predictions found.');
    } else {
      predictions.forEach((p, i) => {
        console.log(`[${i+1}] Status: ${p.status}, Risk: ${p.risk_score}, Cause: ${p.cause}`);
      });
    }

    console.log('\n--- RECENT ALERTS ---');
    const alerts = await Alert.find({ animal_id: animalId })
      .sort({ created_at: -1 })
      .limit(3);
    
    if (alerts.length === 0) {
      console.log('❌ No alerts found.');
    } else {
      alerts.forEach((a, i) => {
        console.log(`[${i+1}] Type: ${a.type}, Severity: ${a.severity}, Message: ${a.message}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error checking results:', err.message);
    process.exit(1);
  }
}

check();
