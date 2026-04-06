// ============================================================
// Smart Virtual Fence System — Geofence Detection Implementation
// ============================================================

#include "geofence.h"
#include "config.h"
#include <math.h>

GeofenceDetector::GeofenceDetector() {
  _params = { DEFAULT_GF_LAT, DEFAULT_GF_LON, DEFAULT_GF_RADIUS_M, true };
}

void GeofenceDetector::setParams(double lat, double lon, float radiusM) {
  _params.centerLat = lat;
  _params.centerLon = lon;
  _params.radiusM   = radiusM;
  _params.isSet     = true;
}

GeofenceParams GeofenceDetector::getParams() const {
  return _params;
}

bool GeofenceDetector::isBreach(double lat, double lon) const {
  if (!_params.isSet) return false;
  return distanceTo(lat, lon) > _params.radiusM;
}

double GeofenceDetector::distanceTo(double lat, double lon) const {
  return haversine(lat, lon, _params.centerLat, _params.centerLon);
}

double GeofenceDetector::toRad(double deg) {
  return deg * M_PI / 180.0;
}

double GeofenceDetector::haversine(double lat1, double lon1, double lat2, double lon2) {
  const double R = 6371000.0; // Earth radius in metres
  double dLat = toRad(lat2 - lat1);
  double dLon = toRad(lon2 - lon1);
  double a = sin(dLat / 2) * sin(dLat / 2) +
             cos(toRad(lat1)) * cos(toRad(lat2)) *
             sin(dLon / 2) * sin(dLon / 2);
  return 2.0 * R * asin(sqrt(a));
}
