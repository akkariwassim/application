'use strict';

const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

router.use(authenticate);
router.use(checkRole([]));

router.get('/animal/:animalId', statsController.getAnimalStats);
router.get('/farm', statsController.getFarmStats);

module.exports = router;
