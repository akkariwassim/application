#pragma once
// ============================================================
// Smart Virtual Fence System — Geofence Detection
// ============================================================

#include <Arduino.h>

struct GeofenceParams {
  double centerLat;
  double centerLon;
  float  radiusM;
  bool   isSet;
};

class GeofenceDetector {
public:
  GeofenceDetector();

  void setParams(double lat, double lon, float radiusM);
  GeofenceParams getParams() const;

  /**
   * Check if position is outside the geofence.
   * @returns true if BREACHED (outside), false if inside
   */
  bool isBreach(double lat, double lon) const;

  /** Distance in metres from centre */
  double distanceTo(double lat, double lon) const;

private:
  GeofenceParams _params;

  static double haversine(double lat1, double lon1, double lat2, double lon2);
  static double toRad(double deg);
};
