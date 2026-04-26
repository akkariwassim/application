'use strict';

const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authenticate } = require('../middleware/auth');

router.get('/animal/:animalId', authenticate, statsController.getAnimalStats);
router.get('/farm', authenticate, statsController.getFarmStats);

module.exports = router;
