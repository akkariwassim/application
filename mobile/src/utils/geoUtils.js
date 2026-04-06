/**
 * Geographic utility functions for the Smart Virtual Fence.
 */

/**
 * Calculates the centroid (mean center) of a set of coordinates.
 * @param {Array} coordinates - Array of { latitude, longitude } objects.
 * @returns {Object|null} { latitude, longitude } or null if empty.
 */
export function calculateCentroid(coordinates) {
  if (!coordinates || coordinates.length === 0) return null;

  let totalLat = 0;
  let totalLon = 0;

  coordinates.forEach((coord) => {
    totalLat += coord.latitude;
    totalLon += coord.longitude;
  });

  return {
    latitude: totalLat / coordinates.length,
    longitude: totalLon / coordinates.length,
  };
}
