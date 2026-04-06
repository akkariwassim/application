'use strict';

const Animal   = require('../models/Animal');
const Geofence = require('../models/Geofence');
const { emitPositionUpdate } = require('../config/socket');

/**
 * GET /api/animals
 */
async function listAnimals(req, res, next) {
  try {
    const animals = await Animal.findByUser(req.user.id);
    res.json(animals);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/animals/:id
 */
async function getAnimal(req, res, next) {
  try {
    const animal = await Animal.findById(req.params.id, req.user.id);
    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    const geofence = await Geofence.findByAnimal(req.params.id);
    res.json({ ...animal, geofence });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals
 */
async function createAnimal(req, res, next) {
  try {
    const { name, type, breed, weightKg, birthDate, rfidTag, deviceId, colorHex, notes } = req.body;
    const id = await Animal.create({
      userId: req.user.id, name, type, breed, weightKg, birthDate,
      rfidTag, deviceId, colorHex, notes
    });
    const animal = await Animal.findById(id, req.user.id);
    res.status(201).json(animal);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/animals/:id
 */
async function updateAnimal(req, res, next) {
  try {
    const ok = await Animal.update(req.params.id, req.user.id, req.body);
    if (!ok) return res.status(404).json({ error: 'Animal not found' });
    const animal = await Animal.findById(req.params.id, req.user.id);
    res.json(animal);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/animals/:id
 */
async function deleteAnimal(req, res, next) {
  try {
    const ok = await Animal.delete(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Animal not found' });
    res.json({ message: 'Animal deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals/:id/geofence
 */
async function setGeofence(req, res, next) {
  try {
    const animal = await Animal.findById(req.params.id, req.user.id);
    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    const { type, centerLat, centerLon, radiusM, polygonCoords } = req.body;
    const gfId = await Geofence.upsert(req.params.id, { type, centerLat, centerLon, radiusM, polygonCoords });
    const geofence = await Geofence.findByAnimal(req.params.id);
    res.status(201).json(geofence);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/animals/:id/geofence
 */
async function getGeofence(req, res, next) {
  try {
    const animal = await Animal.findById(req.params.id, req.user.id);
    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    const geofence = await Geofence.findByAnimal(req.params.id);
    if (!geofence) return res.status(404).json({ error: 'No geofence defined' });
    res.json(geofence);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAnimals, getAnimal, createAnimal, updateAnimal, deleteAnimal,
  setGeofence, getGeofence
};
