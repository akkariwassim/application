'use strict';

const Device = require('../models/Device');

/**
 * GET /api/devices
 * Returns a list of all devices in the fleet.
 * Supports status filtering (?status=free).
 */
async function getDevices(req, res, next) {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const devices = await Device.find(query).sort({ device_id: 1 });
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/devices
 * Manually register a new device in the fleet.
 */
async function createDevice(req, res, next) {
  try {
    const { device_id, name, type } = req.body;
    
    // Check if device already exists
    const existing = await Device.findOne({ device_id });
    if (existing) {
      return res.status(400).json({ 
        success: false,
        error: 'DUPLICATE_DEVICE_REGISTRY', 
        message: 'Ce terminal est déjà enregistré dans la flotte.' 
      });
    }

    const device = await Device.create({ device_id, name, type });
    res.status(201).json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/devices/:id
 * Remove hardware from the fleet if it's not currently assigned.
 */
async function deleteDevice(req, res, next) {
  try {
    const { id } = req.params;
    const device = await Device.findById(id);
    
    if (!device) return res.status(404).json({ 
      success: false,
      error: 'DEVICE_NOT_FOUND',
      message: 'Terminal non trouvé.' 
    });
    if (device.status === 'assigned') {
      return res.status(400).json({ 
        success: false,
        error: 'DEVICE_IN_USE', 
        message: 'Impossible de supprimer un terminal assigné à un animal.' 
      });
    }

    await device.deleteOne();
    res.json({ success: true, message: 'Terminal retiré de la flotte.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDevices,
  createDevice,
  deleteDevice
};
