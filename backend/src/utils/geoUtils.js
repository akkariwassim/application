'use strict';

/**
 * Checks if a coordinate is inside a polygon.
 * @param {Array} polygon - Array of [lat, lon] or {latitude, longitude}
 * @param {Object} point - { latitude, longitude }
 * @returns {Boolean}
 */
function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;

  const x = point.latitude;
  const y = point.longitude;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude !== undefined ? polygon[i].latitude : polygon[i][0];
    const yi = polygon[i].longitude !== undefined ? polygon[i].longitude : polygon[i][1];
    const xj = polygon[j].latitude !== undefined ? polygon[j].latitude : polygon[j][0];
    const yj = polygon[j].longitude !== undefined ? polygon[j].longitude : polygon[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculates the area of a polygon in square meters (Geodesic).
 * @param {Array} coords - Array of { latitude, longitude }
 */
function calculatePolygonArea(coords) {
  if (!coords || coords.length < 3) return 0;
  
  const RADIUS = 6378137; // Earth radius in meters
  let area = 0;

  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const p1 = coords[i];
    const p2 = coords[j];
    
    area += (p2.longitude * Math.PI / 180 - p1.longitude * Math.PI / 180) * 
            (2 + Math.sin(p1.latitude * Math.PI / 180) + Math.sin(p2.latitude * Math.PI / 180));
  }

  area = Math.abs(area * RADIUS * RADIUS / 2);
  return area;
}

/**
 * Calculates the perimeter of a polygon in meters.
 * @param {Array} coords - Array of { latitude, longitude }
 */
function calculatePerimeter(coords) {
  if (!coords || coords.length < 2) return 0;
  
  const R = 6378137;
  let perimeter = 0;

  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const p1 = coords[i];
    const p2 = coords[j];

    const lat1 = p1.latitude * Math.PI / 180;
    const lat2 = p2.latitude * Math.PI / 180;
    const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
    const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    perimeter += R * c;
  }

  return perimeter;
}

module.exports = {
  isPointInPolygon,
  calculatePolygonArea,
  calculatePerimeter
};
