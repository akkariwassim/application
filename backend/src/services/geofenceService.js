'use strict';

/**
 * Geofence Service
 * Provides distance calculations and breach detection logic.
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
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in metres
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
 * Check if a point is inside a circle geofence.
 *
 * @param {number} lat       - Current latitude
 * @param {number} lon       - Current longitude
 * @param {number} centerLat - Geofence centre latitude
 * @param {number} centerLon - Geofence centre longitude
 * @param {number} radiusM   - Geofence radius in metres
 * @returns {{ inside: boolean, distanceM: number }}
 */
function checkCircleGeofence(lat, lon, centerLat, centerLon, radiusM) {
  const distanceM = haversineDistance(lat, lon, centerLat, centerLon);
  return {
    inside: distanceM <= radiusM,
    distanceM: Math.round(distanceM)
  };
}

/**
 * Ray-casting algorithm to check if a point is inside a polygon.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Array<{lat: number, lon: number}>} polygon
 * @returns {boolean}
 */
function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon, yi = polygon[i].lat;
    const xj = polygon[j].lon, yj = polygon[j].lat;
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * High-level breach check given a geofence DB record.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Object} geofence - Row from geofences table
 * @returns {{ breached: boolean, distanceM: number|null }}
 */
function checkBreach(lat, lon, geofence) {
  if (!geofence) return { breached: false, distanceM: null };

  if (geofence.type === 'circle') {
    const { inside, distanceM } = checkCircleGeofence(
      lat, lon,
      parseFloat(geofence.center_lat),
      parseFloat(geofence.center_lon),
      parseFloat(geofence.radius_m)
    );
    return { breached: !inside, distanceM };
  }

  if (geofence.type === 'polygon' && geofence.polygon_coords) {
    const polygon =
      typeof geofence.polygon_coords === 'string'
        ? JSON.parse(geofence.polygon_coords)
        : geofence.polygon_coords;
    const inside = pointInPolygon(lat, lon, polygon);
    return { breached: !inside, distanceM: null };
  }

  return { breached: false, distanceM: null };
}

module.exports = {
  haversineDistance,
  checkCircleGeofence,
  pointInPolygon,
  checkBreach
};
