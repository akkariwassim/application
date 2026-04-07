'use strict';

const Animal = require('../models/Animal');
const Zone   = require('../models/Zone');
const { emitPositionUpdate } = require('../config/socket');

/**
 * GET /api/animals
 */
async function listAnimals(req, res, next) {
  try {
    const animals = await Animal.find({ userId: req.user.id }).populate('currentZoneId');
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
    const animal = await Animal.findOne({ _id: req.params.id, userId: req.user.id }).populate('currentZoneId');
    if (!animal) return res.status(404).json({ error: 'Animal not found' });

    res.json(animal);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals
 */
async function createAnimal(req, res, next) {
  try {
    const animalData = { ...req.body, userId: req.user.id };
    const animal = await Animal.create(animalData);
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
    const animal = await Animal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!animal) return res.status(404).json({ error: 'Animal not found' });
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
    const result = await Animal.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Animal not found' });
    res.json({ message: 'Animal deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals/:id/zone
 * Sets or updates the primary zone for an animal
 */
async function setZone(req, res, next) {
  try {
    const { zoneId } = req.body;
    const animal = await Animal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { currentZoneId: zoneId } },
      { new: true }
    ).populate('currentZoneId');

    if (!animal) return res.status(404).json({ error: 'Animal not found' });
    res.json(animal);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAnimals, getAnimal, createAnimal, updateAnimal, deleteAnimal, setZone
};
