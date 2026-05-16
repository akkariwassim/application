'use strict';

const axios = require('axios');
const logger = require('../utils/logger');
const AIPrediction = require('../models/AIPrediction');
const Alert = require('../models/Alert');
const socketConfig = require('../config/socket');
const Animal = require('../models/Animal');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

/**
 * Call AI Microservice with retries
 */
async function callAIService(payload, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/ai/predict`, payload, {
        timeout: 5000
      });
      return response.data;
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = Math.pow(2, i) * 1000;
      logger.warn(`AI Service attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Call AI Microservice and save results
 */
async function processAIPrediction(animal, sensorData) {
  try {
    const payload = {
      animal_id: animal._id.toString(),
      temperature: sensorData.temperature,
      heart_rate: animal.heart_rate || 80, 
      activity: sensorData.activity,
      speed: sensorData.speed || 0.1,
      gps: {
        latitude: sensorData.latitude,
        longitude: sensorData.longitude
      }
    };

    logger.info(`🤖 AI Request: animal=${animal.name} temp=${payload.temperature}°C`);
    
    const prediction = await callAIService(payload);

    // Save to DB
    const savedPrediction = await AIPrediction.create({
      animal_id: animal._id,
      user_id: animal.user_id,
      farm_id: animal.farm_id,
      status: prediction.status,
      risk_score: prediction.risk_score,
      prediction: prediction.prediction,
      cause: prediction.cause,
      recommendation: prediction.recommendation,
      confidence: prediction.confidence
    });

    // Handle Critical Status
    if (prediction.status === 'CRITICAL') {
      logger.error(`🚨 AI CRITICAL ALERT [${animal.name}]: ${prediction.cause}`);
      
      const alert = await Alert.create({
        animal_id: animal._id,
        user_id: animal.user_id,
        farm_id: animal.farm_id,
        type: 'health_critical',
        severity: 'critical',
        message: `🤖 AI Alert: ${prediction.cause}. ${prediction.recommendation}`,
        location: {
          type: 'Point',
          coordinates: [sensorData.longitude, sensorData.latitude]
        },
        metadata: {
          risk_score: prediction.risk_score,
          ai_recommendation: prediction.recommendation
        }
      });

      // Update animal status to danger
      await Animal.findByIdAndUpdate(animal._id, { $set: { status: 'danger' } });

      // Broadcast via Socket
      socketConfig.emitAlert(animal.farm_id, animal._id, alert);
      socketConfig.emitStatusChange(animal.farm_id, animal._id, 'danger');
    }

    return savedPrediction;

  } catch (err) {
    logger.error(`❌ AI Service Final Error: ${err.message}`);
    return null;
  }
}

module.exports = {
  processAIPrediction
};
