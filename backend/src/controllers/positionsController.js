'use strict';

const Animal     = require('../models/Animal');
const SensorData = require('../models/SensorData');
const logger     = require('../utils/logger');

/**
 * Update animal position /api/positions
 * Expects { animalId, latitude, longitude, temperature, activity }
 */
async function submitPosition(req, res, next) {
  try {
    const { animalId, latitude, longitude, temperature, activity } = req.body;
    
    // 1. Update the Animal with latest metrics
    const animal = await Animal.findOneAndUpdate(
      { _id: animalId, user_id: req.user.id },
      { 
        $set: { 
          latitude, 
          longitude, 
          temperature: temperature || 38.5, 
          activity: activity || 50,
          last_seen: new Date()
        } 
      },
      { new: true }
    );
    
    if (!animal) return res.status(404).json({ error: 'Animal not found' });
    
    // 2. Create history record in SensorData
    await SensorData.create({
      animal_id: animal._id,
      user_id: req.user._id,
      latitude,
      longitude,
      temperature: temperature || 38.5,
      activity: activity || 50,
      timestamp: new Date()
    });
    
    res.json({ message: 'Position updated successfully', animal });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/positions/:animalId/history
 */
async function getHistory(req, res, next) {
  try {
    const { animalId } = req.params;
    const history = await SensorData.find({ 
      animal_id: animalId, 
      user_id: req.user.id 
    }).sort({ timestamp: -1 }).limit(100);
    
    res.json(history);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/positions/:animalId/latest
 */
async function getLatest(req, res, next) {
  try {
    const { animalId } = req.params;
    const latest = await SensorData.findOne({ 
      animal_id: animalId, 
      user_id: req.user.id 
    }).sort({ timestamp: -1 });
    
    if (!latest) return res.status(404).json({ error: 'No history found' });
    res.json(latest);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitPosition,
  getHistory,
  getLatest
};
