'use strict';

const router = require('express').Router();
const AIPrediction = require('../models/AIPrediction');
const { authenticate } = require('../middleware/auth');
const { param, query } = require('express-validator');
const validate = require('../middleware/validate');

/**
 * GET /api/ai/animal/:animalId
 * Get the latest AI predictions for an animal
 */
router.get('/animal/:animalId', [
  authenticate,
  param('animalId').isMongoId().withMessage('Invalid animal ID'),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate
], async (req, res, next) => {
  try {
    const { animalId } = req.params;
    const limit = parseInt(req.query.limit) || 1;

    const predictions = await AIPrediction.find({
      animal_id: animalId,
      user_id: req.user.id
    })
    .sort({ timestamp: -1 })
    .limit(limit);

    if (!predictions || predictions.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'NO_AI_DATA',
        message: 'No AI data found for this animal' 
      });
    }

    res.json({ success: true, data: limit === 1 ? predictions[0] : predictions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
