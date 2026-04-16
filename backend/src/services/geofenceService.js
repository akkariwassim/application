'use strict';

/**
 * Geofence Service
 * Provides distance calculations and breach detection logic.
 * Updated to support GeoJSON format from MongoDB.
 */

const EARTH_RADIUS_M = 6_371_000; // metres

/**
 * Convert degrees to radians.
 */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the Haversine distance (in metres) between two GPS coordinates.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Ray-casting algorithm to check if a point is inside a polygon.
 * GeoJSON format: polygon is [[[lon, lat], [lon, lat], ...]] (first ring)
 */
function pointInPolygon(lat, lon, coordinates) {
  const polygon = coordinates[0]; // First ring
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]; // [lon, lat]
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * High-level breach check given a geofence Mongoose document.
 */
function checkBreach(lat, lon, zone) {
  // Zone is a Mongoose document (Zone model)
  if (!zone || !zone.is_active) return { breached: false, distanceM: null };

  // Circle check (using center and radiusM)
  if (zone.radiusM && zone.center) {
    const [centerLon, centerLat] = zone.center.coordinates;
    const distanceM = haversineDistance(lat, lon, centerLat, centerLon);
    return {
      breached: distanceM > zone.radiusM,
      distanceM: Math.round(distanceM)
    };
  }

  // Polygon check (using GeoJSON geometry)
  if (zone.geometry && zone.geometry.type === 'Polygon') {
    const inside = pointInPolygon(lat, lon, zone.geometry.coordinates);
    
    // If it's an exclusion zone, breach is when INSIDE. 
    // If it's a grazing zone, breach is when OUTSIDE.
    const isExclusion = zone.zone_type === 'exclusion' || zone.zone_type === 'hazard';
    const breached = isExclusion ? inside : !inside;

    return { breached, distanceM: null };
  }

  return { breached: false, distanceM: null };
}

module.exports = {
  haversineDistance,
  pointInPolygon,
  checkBreach
};
