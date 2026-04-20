'use strict';

const Animal = require('../models/Animal');
const Zone   = require('../models/Zone');
const Device = require('../models/Device');

/**
 * Generate a random point guaranteed to be inside a polygon.
 * Uses bounding-box rejection sampling.
 */
function randomPointInPolygon(coords) {
  if (!coords || coords.length < 3) return null;

  // Compute bounding box
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const c of coords) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLon) minLon = c.longitude;
    if (c.longitude > maxLon) maxLon = c.longitude;
  }

  // Rejection sampling: pick random points in the bounding box until one is inside
  for (let attempt = 0; attempt < 200; attempt++) {
    const lat = minLat + Math.random() * (maxLat - minLat);
    const lon = minLon + Math.random() * (maxLon - minLon);

    if (isPointInsidePolygon(lat, lon, coords)) {
      return { latitude: lat, longitude: lon };
    }
  }

  // Fallback: centroid
  const centLat = coords.reduce((s, c) => s + c.latitude, 0) / coords.length;
  const centLon = coords.reduce((s, c) => s + c.longitude, 0) / coords.length;
  return { latitude: centLat, longitude: centLon };
}

/**
 * Ray-casting point-in-polygon test
 */
function isPointInsidePolygon(lat, lon, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude, yi = polygon[i].longitude;
    const xj = polygon[j].latitude, yj = polygon[j].longitude;
    const intersect = ((yi > lon) !== (yj > lon)) && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

const isAtZero = (lat, lon) => {
  const l = parseFloat(lat);
  const n = parseFloat(lon);
  return isNaN(l) || isNaN(n) || (Math.abs(l) < 0.001 && Math.abs(n) < 0.001);
};

/**
 * Given a zone, returns a random coordinate inside it
 */
async function getRandomPointInZone(zoneId) {
  const zone = await Zone.findById(zoneId);
  if (!zone) return null;

  if (zone.polygon_coords) {
    const coords = typeof zone.polygon_coords === 'string' ? JSON.parse(zone.polygon_coords) : zone.polygon_coords;
    if (coords.length >= 3) {
      return randomPointInPolygon(coords);
    }
  }

  // Fallback to center
  if (zone.center_lat && zone.center_lon) {
    return { latitude: zone.center_lat, longitude: zone.center_lon };
  }

  return null;
}

/**
 * GET /api/animals
 * Supports: pagination, search, sorting, and filtering
 */
async function getAnimals(req, res, next) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status, 
      type, 
      zone_id,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const query = { user_id: req.user.id };

    // ── Filters ───────────────────────────────────────────────────
    if (status) query.status = status;
    if (type)   query.type = type;
    if (zone_id) query.current_zone_id = zone_id;

    // ── Search ────────────────────────────────────────────────────
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { device_id: { $regex: search, $options: 'i' } },
        { rfid_tag: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitInt = parseInt(limit);

    const [animals, total, stats] = await Promise.all([
      Animal.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limitInt),
      Animal.countDocuments(query),
      // Aggregate stats for the user
      Animal.aggregate([
        { $match: { user_id: req.user.id } },
        { $group: { 
          _id: "$status", 
          count: { $sum: 1 } 
        }}
      ])
    ]);

    // Format stats into a clean object
    const statsObj = { total, safe: 0, warning: 0, danger: 0, offline: 0 };
    stats.forEach(s => {
      if (s._id) statsObj[s._id] = s.count;
    });

    res.json({
      success: true,
      data: {
        animals,
        stats: statsObj,
        pagination: {
          total,
          page: parseInt(page),
          limit: limitInt,
          pages: Math.ceil(total / limitInt),
          hasMore: skip + animals.length < total
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/animals/:id
 */
async function getAnimal(req, res, next) {
  try {
    const { id } = req.params;
    const animal = await Animal.findOne({ _id: id, user_id: req.user.id });
    if (!animal) return res.status(404).json({ 
      success: false,
      error: 'ANIMAL_NOT_FOUND',
      message: 'Animal non trouvé.' 
    });
    res.json({ success: true, data: animal });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals
 */
async function createAnimal(req, res, next) {
  try {
    const { name, type, breed, age, latitude, longitude, 
            weightKg, birthDate, rfidTag, deviceId, 
            colorHex, notes, avatarUrl, currentZoneId, current_zone_id } = req.body;

    const zoneId = currentZoneId || current_zone_id || null;

    let finalLat = parseFloat(latitude);
    let finalLon = parseFloat(longitude);
    if (isNaN(finalLat)) finalLat = 0;
    if (isNaN(finalLon)) finalLon = 0;

    // If assigned to a zone but coordinates missing/zero → random point inside zone
    if (zoneId && isAtZero(finalLat, finalLon)) {
      const point = await getRandomPointInZone(zoneId);
      if (point) {
        finalLat = point.latitude;
        finalLon = point.longitude;
      }
    }

    const animal = await Animal.create({
      user_id: req.user.id,
      name,
      type,
      breed,
      age: parseInt(age) || 0,
      weight_kg: weightKg,
      birth_date: birthDate,
      rfid_tag:  rfidTag  && rfidTag.trim()  ? rfidTag.trim()  : null,
      device_id: deviceId && deviceId.trim() ? deviceId.trim() : null,
      color_hex: colorHex || '#4CAF50',
      notes,
      avatar_url: avatarUrl,
      latitude:  finalLat,
      longitude: finalLon,
      current_zone_id: zoneId,
      status: 'safe',
      last_seen: new Date()
    });

    // ── Sync Device Status ──
    if (animal.device_id) {
      await Device.findOneAndUpdate(
        { device_id: animal.device_id },
        { status: 'assigned', assigned_to_animal_id: animal._id }
      );
    }
    
    res.status(201).json({ success: true, data: animal });
  } catch (err) {
    if (err.code === 11000) {
      // ── Identify the exact clashing field from the MongoDB error ──
      const conflictQuery = err.keyValue ? { ...err.keyValue } : null;
      
      let existing = null;
      if (conflictQuery) {
        existing = await Animal.findOne(conflictQuery).lean();
      }

      const conflictMsg = existing 
        ? `L'animal "${existing.name}" utilise déjà cet ID/RFID.`
        : 'Ce device_id ou rfid_tag est déjà utilisé par un autre animal.';

      return res.status(400).json({ 
        success: false,
        error: 'DUPLICATE_DEVICE', 
        message: conflictMsg,
        field: Object.keys(err.keyValue || {})[0],
        existingAnimal: existing ? { id: existing.id || existing._id, name: existing.name } : null
      });
    }
    next(err);
  }
}

/**
 * PUT /api/animals/:id
 */
async function updateAnimal(req, res, next) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Remap camelCase from frontend if needed
    if (updates.weightKg) { updates.weight_kg = updates.weightKg; delete updates.weightKg; }
    if (updates.birthDate) { updates.birth_date = updates.birthDate; delete updates.birthDate; }
    if (updates.rfidTag) { updates.rfid_tag = updates.rfidTag; delete updates.rfidTag; }
    if (updates.deviceId) { updates.device_id = updates.deviceId; delete updates.deviceId; }
    if (updates.colorHex) { updates.color_hex = updates.colorHex; delete updates.colorHex; }
    if (updates.avatarUrl) { updates.avatar_url = updates.avatarUrl; delete updates.avatarUrl; }
    if (updates.heartRate) { updates.heart_rate = updates.heartRate; delete updates.heartRate; }
    if (updates.batteryLevel) { updates.battery_level = updates.batteryLevel; delete updates.batteryLevel; }
    if (updates.signalStrength) { updates.signal_strength = updates.signalStrength; delete updates.signalStrength; }
    
    if (updates.currentZoneId) { 
      updates.current_zone_id = updates.currentZoneId; 
      delete updates.currentZoneId; 
    }

    const existing = await Animal.findOne({ _id: id, user_id: req.user.id });
    if (!existing) return res.status(404).json({ 
      success: false, 
      error: 'ANIMAL_NOT_FOUND',
      message: 'Animal non trouvé.'
    });

    const currentLat = updates.latitude !== undefined ? updates.latitude : existing.latitude;
    const currentLon = updates.longitude !== undefined ? updates.longitude : existing.longitude;
    const zoneId = updates.current_zone_id || existing.current_zone_id;

    // Auto-place inside zone if animal is at 0,0
    if (zoneId && isAtZero(currentLat, currentLon)) {
      const point = await getRandomPointInZone(zoneId);
      if (point) {
        updates.latitude = point.latitude;
        updates.longitude = point.longitude;
      }
    }

    const animal = await Animal.findOneAndUpdate(
      { _id: id, user_id: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!animal) return res.status(404).json({ 
      success: false,
      error: 'ANIMAL_NOT_FOUND',
      message: 'Animal non trouvé.'
    });
    res.json({ success: true, data: animal });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/animals/:id
 */
async function deleteAnimal(req, res, next) {
  try {
    const { id } = req.params;
    const animal = await Animal.findOne({ _id: id, user_id: req.user.id });
    if (!animal) return res.status(404).json({ 
      success: false,
      error: 'ANIMAL_NOT_FOUND',
      message: 'Animal non trouvé.'
    });

    // ── Release Device Status ──
    if (animal.device_id) {
      await Device.findOneAndUpdate(
        { device_id: animal.device_id },
        { status: 'free', assigned_to_animal_id: null }
      );
    }

    await Animal.deleteOne({ _id: id });
    res.json({ success: true, message: 'Animal deleted successfully and device released.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/animals/:id/zone
 * Compatibility alias for mobile app
 */
async function getZone(req, res, next) {
  try {
    const { id } = req.params;
    const animal = await Animal.findOne({ _id: id, user_id: req.user.id });
    if (!animal || !animal.current_zone_id) return res.json({ success: true, data: null });
    
    const zone = await Zone.findById(animal.current_zone_id);
    res.json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals/:id/geofence
 * Compatibility alias for setGeofence in mobile store
 */
async function setZone(req, res, next) {
  try {
    const { id } = req.params;
    const { geofenceId } = req.body;
    
    const animal = await Animal.findOneAndUpdate(
      { _id: id, user_id: req.user.id },
      { $set: { current_zone_id: geofenceId } },
      { new: true }
    );
    
    if (!animal) return res.status(404).json({ 
      success: false,
      error: 'ANIMAL_NOT_FOUND',
      message: 'Animal non trouvé.'
    });
    res.json({ success: true, data: animal });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/animals/bulk
 */
async function bulkCreateAnimals(req, res, next) {
  try {
    const { animals } = req.body;
    const userId = req.user.id;
    const results = { imported: 0, skipped: 0, errors: [] };

    for (const data of animals) {
      try {
        await Animal.create({
          user_id: userId,
          name: data.name,
          type: data.type || 'other',
          rfid_tag: data.rfidTag || data.rfid_tag || null,
          device_id: data.deviceId || data.device_id || null,
          status: 'safe',
          last_seen: new Date()
        });
        results.imported++;
      } catch (err) {
        results.skipped++;
        results.errors.push({ name: data.name, error: err.message });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAnimals,
  getAnimal,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  getZone,
  setZone,
  bulkCreateAnimals
};
