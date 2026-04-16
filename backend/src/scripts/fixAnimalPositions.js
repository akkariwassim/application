'use strict';

/**
 * Migration: Relocate all animals at 0,0 to a random point inside their assigned zone.
 * Run once: node src/scripts/fixAnimalPositions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Animal   = require('../models/Animal');
const Zone     = require('../models/Zone');

// ── Helpers ────────────────────────────────────────────────────────────────

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

function randomPointInPolygon(coords) {
  if (!coords || coords.length < 3) return null;

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const c of coords) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLon) minLon = c.longitude;
    if (c.longitude > maxLon) maxLon = c.longitude;
  }

  for (let attempt = 0; attempt < 200; attempt++) {
    const lat = minLat + Math.random() * (maxLat - minLat);
    const lon = minLon + Math.random() * (maxLon - minLon);
    if (isPointInsidePolygon(lat, lon, coords)) {
      return { latitude: lat, longitude: lon };
    }
  }

  // Fallback centroid
  return {
    latitude:  coords.reduce((s, c) => s + c.latitude,  0) / coords.length,
    longitude: coords.reduce((s, c) => s + c.longitude, 0) / coords.length,
  };
}

const isAtZero = (lat, lon) => {
  const l = parseFloat(lat), n = parseFloat(lon);
  return isNaN(l) || isNaN(n) || (Math.abs(l) < 0.001 && Math.abs(n) < 0.001);
};

// ── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) { console.error('Missing MONGODB_URI in .env'); process.exit(1); }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Find all animals at 0,0 that have a zone assigned
  const lostAnimals = await Animal.find({
    current_zone_id: { $exists: true, $ne: null },
    $or: [
      { latitude: { $gte: -0.001, $lte: 0.001 } },
      { longitude: { $gte: -0.001, $lte: 0.001 } },
    ]
  });

  console.log(`Found ${lostAnimals.length} animal(s) stuck at 0,0 with an assigned zone.`);

  let fixed = 0;
  for (const animal of lostAnimals) {
    if (!isAtZero(animal.latitude, animal.longitude)) continue;

    const zone = await Zone.findById(animal.current_zone_id);
    if (!zone) { console.log(`  ⚠️  Zone not found for animal ${animal.name}`); continue; }

    let point = null;
    if (zone.polygon_coords) {
      const coords = typeof zone.polygon_coords === 'string'
        ? JSON.parse(zone.polygon_coords) : zone.polygon_coords;
      if (coords.length >= 3) point = randomPointInPolygon(coords);
    }
    if (!point && zone.center_lat && zone.center_lon) {
      point = { latitude: zone.center_lat, longitude: zone.center_lon };
    }

    if (!point) { console.log(`  ⚠️  Could not compute position for animal ${animal.name}`); continue; }

    await Animal.findByIdAndUpdate(animal._id, {
      $set: {
        latitude:  point.latitude,
        longitude: point.longitude,
        current_location: { type: 'Point', coordinates: [point.longitude, point.latitude] }
      }
    });

    console.log(`  ✅  Moved "${animal.name}" → (${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}) inside zone "${zone.name}"`);
    fixed++;
  }

  console.log(`\nDone! Fixed ${fixed}/${lostAnimals.length} animals.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
