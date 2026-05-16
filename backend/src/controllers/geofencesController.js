'use strict';

const Zone   = require('../models/Zone');
const logger = require('../utils/logger');

/**
 * GET /api/geofences
 */
async function getGeofences(req, res, next) {
  try {
    const zones = await Zone.find({ farm_id: req.farm_id });
    res.json({ success: true, data: zones });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/geofences
 */
async function createGeofence(req, res, next) {
  try {
    const { 
      type, name, centerLat, centerLon, radiusM, polygonCoords,
      isActive, isPrimary, zoneType, priorityLevel, fillColor, areaSqm,
      // Support snake_case fallbacks
      polygon_coords, zone_type, center_lat, center_lon, radius_m, area_sqm
    } = req.body;
    
    const finalType = type || 'polygon';
    const finalName = name;
    const finalPolygonCoords = polygonCoords || polygon_coords;
    const finalZoneType = zoneType || zone_type || type || 'grazing';
    const finalLat = parseFloat(centerLat || center_lat || 0);
    const finalLon = parseFloat(centerLon || center_lon || 0);
    const finalRadius = parseFloat(radiusM || radius_m || 0);
    const finalArea = parseFloat(areaSqm || area_sqm || 0);
    
    // Check for unique name
    if (name) {
      const existing = await Zone.findOne({ farm_id: req.farm_id, name });
      if (existing) {
        return res.status(400).json({ 
          success: false,
          error: 'NAME_TAKEN', 
          message: `Le nom "${name}" est déjà utilisé.` 
        });
      }
    }

    // Helper to extract [lon, lat] from various point formats
    const toPoint = (p) => {
      if (Array.isArray(p)) return [parseFloat(p[0]), parseFloat(p[1])];
      return [parseFloat(p.longitude || p.lon || p.lng), parseFloat(p.latitude || p.lat)];
    };

    let coordinates = finalPolygonCoords;
    if (typeof coordinates === 'string') {
      try { coordinates = JSON.parse(coordinates); } catch (e) { /* ignore */ }
    }

    let normalizedCoords = [];
    if (Array.isArray(coordinates)) {
      // If it's 1-level: [ {lat, lon}, ... ] or [ [lon, lat], ... ]
      if (!Array.isArray(coordinates[0]) || typeof coordinates[0][0] === 'number') {
        normalizedCoords = [coordinates.map(toPoint)];
      } 
      // If it's 2-level: [ [ {lat, lon}, ... ] ]
      else if (Array.isArray(coordinates[0]) && typeof coordinates[0][0] === 'object' && !Array.isArray(coordinates[0][0])) {
        normalizedCoords = [coordinates[0].map(toPoint)];
      }
      // If it's already 3-level or deeper, check first ring
      else if (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0])) {
        // Ensure ring is formatted as numbers
        normalizedCoords = [coordinates[0].map(toPoint)];
      }

      // GeoJSON Polygon MUST be closed (last point = first point)
      if (normalizedCoords.length > 0 && normalizedCoords[0].length > 0) {
        const first = normalizedCoords[0][0];
        const last = normalizedCoords[0][normalizedCoords[0].length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          normalizedCoords[0].push([...first]);
        }
      }
    }

    // Convert center if needed
    const lon = parseFloat(centerLon || 0);
    const lat = parseFloat(centerLat || 0);

    const zone = await Zone.create({
      user_id: req.user.id,
      farm_id: req.farm_id,
      name: finalName,
      description: req.body.description,
      zone_type: finalZoneType,
      polygon_coords: finalPolygonCoords,
      geometry: {
        type: 'Polygon',
        coordinates: normalizedCoords
      },
      center_lat: finalLat,
      center_lon: finalLon,
      center: {
        type: 'Point',
        coordinates: [finalLon, finalLat]
      },
      radiusM: finalRadius,
      is_active: isActive !== undefined ? isActive : true,
      is_primary: isPrimary || 0,
      priority_level: priorityLevel || 1,
      fill_color: fillColor || '#4F46E5',
      area_sqm: finalArea
    });
    
    res.status(201).json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/geofences/:id
 */
async function updateGeofence(req, res, next) {
  try {
    const { id } = req.params;
    const { 
      name, centerLat, centerLon, polygonCoords, isActive, isPrimary, zoneType, priorityLevel, fillColor, areaSqm,
      polygon_coords, zone_type, center_lat, center_lon, radius_m, area_sqm
    } = req.body;
    
    // Check for unique name (exclude self)
    if (name) {
      const existing = await Zone.findOne({ farm_id: req.farm_id, name, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ 
          success: false,
          error: 'NAME_TAKEN', 
          message: `Le nom "${name}" est déjà utilisé pour une autre zone.` 
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (req.body.description) updateData.description = req.body.description;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (isPrimary !== undefined) updateData.is_primary = isPrimary;
    if (zoneType || zone_type) updateData.zone_type = zoneType || zone_type;
    if (priorityLevel) updateData.priority_level = priorityLevel;
    if (fillColor) updateData.fill_color = fillColor;
    if (areaSqm || area_sqm) updateData.area_sqm = areaSqm || area_sqm;
    
    const finalPolygonCoords = polygonCoords || polygon_coords;
    if (finalPolygonCoords) {
      const toPoint = (p) => {
        if (Array.isArray(p)) return [parseFloat(p[0]), parseFloat(p[1])];
        return [parseFloat(p.longitude || p.lon || p.lng), parseFloat(p.latitude || p.lat)];
      };

      let coords = polygonCoords;
      if (typeof coords === 'string') {
        try { coords = JSON.parse(coords); } catch (e) { }
      }
      
      let normalized = [];
      if (Array.isArray(coords)) {
        if (!Array.isArray(coords[0]) || typeof coords[0][0] === 'number') {
          normalized = [coords.map(toPoint)];
        } else if (Array.isArray(coords[0]) && typeof coords[0][0] === 'object' && !Array.isArray(coords[0][0])) {
          normalized = [coords[0].map(toPoint)];
        } else if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
          normalized = [coords[0].map(toPoint)];
        }

        if (normalized.length > 0 && normalized[0].length > 0) {
          const first = normalized[0][0];
          const last = normalized[0][normalized[0].length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            normalized[0].push([...first]);
          }
        }
      }
      
      updateData.polygon_coords = finalPolygonCoords; // keep raw
      updateData.geometry = {
        type: 'Polygon',
        coordinates: normalized
      };
    }

    const finalLat = centerLat !== undefined ? centerLat : center_lat;
    const finalLon = centerLon !== undefined ? centerLon : center_lon;

    if (finalLat !== undefined && finalLon !== undefined) {
      updateData.center_lat = parseFloat(finalLat);
      updateData.center_lon = parseFloat(finalLon);
      updateData.center = {
        type: 'Point',
        coordinates: [parseFloat(finalLon), parseFloat(finalLat)]
      };
    }

    const zone = await Zone.findOneAndUpdate(
      { _id: id, farm_id: req.farm_id },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!zone) return res.status(404).json({ 
      success: false,
      error: 'ZONE_NOT_FOUND',
      message: 'Zone non trouvée.'
    });
    
    res.json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/geofences/:id
 */
async function deleteGeofence(req, res, next) {
  try {
    const { id } = req.params;
    const result = await Zone.deleteOne({ _id: id, farm_id: req.farm_id });
    if (result.deletedCount === 0) return res.status(404).json({ 
      success: false,
      error: 'ZONE_NOT_FOUND',
      message: 'Zone non trouvée.'
    });
    res.json({ success: true, data: { message: 'Zone supprimée avec succès.' } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence
};
