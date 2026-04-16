'use strict';

const Device = require('../models/Device');

/**
 * GET /api/devices
 * Query: ?status=free|assigned
 */
async function getDevices(req, res, next) {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const devices = await Device.find(filter).sort({ device_id: 1 });
    res.json(devices);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/devices/:id
 */
async function getDevice(req, res, next) {
  try {
    const { id } = req.params;
    const device = await Device.findOne({ device_id: id });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/devices
 */
async function createDevice(req, res, next) {
  try {
    const { device_id, type, manufacturer } = req.body;
    const device = await Device.create({ device_id, type, manufacturer });
    res.status(201).json(device);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'DUPLICATE_ID', message: 'This hardware ID is already registered' });
    }
    next(err);
  }
}

module.exports = {
  getDevices,
  getDevice,
  createDevice
};
