// ============================================================
// Smart Virtual Fence System — GPS Driver Implementation
// ============================================================

#include "gps.h"

GpsDriver::GpsDriver() : _serial(1) {
  _lastData = { 0, 0, 0, 0, 0, 0, false, 0 };
}

void GpsDriver::begin() {
  _serial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  DEBUG_SERIAL.println(F("[GPS] Initialized NEO-6M on UART1"));
}

void GpsDriver::update() {
  while (_serial.available() > 0) {
    char c = _serial.read();
    if (_gps.encode(c)) {
      // New sentence parsed — update local cache
      if (_gps.location.isValid()) {
        _lastData.latitude  = _gps.location.lat();
        _lastData.longitude = _gps.location.lng();
        _lastData.isValid   = true;
        _lastData.age       = _gps.location.age();
      }
      if (_gps.altitude.isValid())
        _lastData.altitude   = _gps.altitude.meters();
      if (_gps.speed.isValid())
        _lastData.speed      = _gps.speed.kmph();
      if (_gps.hdop.isValid())
        _lastData.hdop       = _gps.hdop.hdop();
      if (_gps.satellites.isValid())
        _lastData.satellites = _gps.satellites.value();
    }
  }
}

bool GpsDriver::hasFix() const {
  return _lastData.isValid && (_lastData.age < 5000); // valid within last 5s
}

GpsData GpsDriver::getData() const {
  return _lastData;
}

bool GpsDriver::waitForFix(unsigned int timeoutSeconds) {
  unsigned long start = millis();
  DEBUG_SERIAL.print(F("[GPS] Waiting for fix"));
  while (millis() - start < (unsigned long)timeoutSeconds * 1000UL) {
    update();
    if (hasFix()) {
      DEBUG_SERIAL.println(F(" OK"));
      return true;
    }
    if ((millis() - start) % 5000 < 100) DEBUG_SERIAL.print('.');
    delay(10);
  }
  DEBUG_SERIAL.println(F(" TIMEOUT"));
  return false;
}
