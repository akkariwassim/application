'use strict';

const axios = require('axios');
const logger = require('../utils/logger');
const AIPrediction = require('../models/AIPrediction');
const Alert = require('../models/Alert');
const socketConfig = require('../config/socket');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

/**
 * Call AI Microservice and save results
 */
async function processAIPrediction(animal, sensorData) {
  try {
    const payload = {
      animal_id: animal._id.toString(),
      temperature: sensorData.temperature,
      heart_rate: animal.heart_rate || 80, // Default if not set
      activity: sensorData.activity,
      speed: 0.1, // TODO: Calculate based on historical distance
      gps: {
        latitude: sensorData.latitude,
        longitude: sensorData.longitude
      }
    };

    logger.info(`Sending data to AI Service for animal ${animal._id}`);
    
    const response = await axios.post(`${AI_SERVICE_URL}/ai/predict`, payload, {
      timeout: 5000
    });

    const prediction = response.data;

    // Save to DB
    const savedPrediction = await AIPrediction.create({
      animal_id: animal._id,
      user_id: animal.user_id,
      status: prediction.status,
      risk_score: prediction.risk_score,
      cause: prediction.cause,
      recommendation: prediction.recommendation,
      confidence: prediction.confidence
    });

    // Handle Critical Status
    if (prediction.status === 'CRITICAL') {
      logger.warn(`AI CRITICAL ALERT for animal ${animal.name}: ${prediction.cause}`);
      
      const alert = await Alert.create({
        animal_id: animal._id,
        user_id: animal.user_id,
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

      // Broadcast via Socket
      socketConfig.emitAlert(animal.user_id, animal._id, alert);
    }

    return savedPrediction;

  } catch (err) {
    logger.error(`AI Service Error: ${err.message}`);
    // Non-blocking error, we don't want to fail the whole ingestion
    return null;
  }
}

module.exports = {
  processAIPrediction
};
