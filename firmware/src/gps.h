#pragma once
// ============================================================
// Smart Virtual Fence System — GPS Driver (NEO-6M via TinyGPS++)
// ============================================================

#include <Arduino.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include "config.h"

struct GpsData {
  double latitude;
  double longitude;
  double altitude;
  double speed;      // km/h
  double hdop;
  int    satellites;
  bool   isValid;
  unsigned long age; // ms since last update
};

class GpsDriver {
public:
  GpsDriver();

  /** Initialize UART and GPS module */
  void begin();

  /** Feed UART bytes into TinyGPS++ parser. Call frequently in loop(). */
  void update();

  /** Returns true if GPS has a valid fix */
  bool hasFix() const;

  /** Get the latest GPS data */
  GpsData getData() const;

  /** Block until first valid fix or timeout. Returns true on success. */
  bool waitForFix(unsigned int timeoutSeconds = GPS_FIX_TIMEOUT_S);

private:
  TinyGPSPlus       _gps;
  HardwareSerial    _serial;
  GpsData           _lastData;
};
