#pragma once
// ============================================================
// Smart Virtual Fence System — Alert Actuators
// ============================================================

#include <Arduino.h>
#include "config.h"

class AlertActuator {
public:
  AlertActuator();

  /** Configure GPIO pins */
  void begin();

  /** Trigger geofence breach alert sequence */
  void triggerBreach();

  /** Clear all actuators */
  void clear();

  /** Set LED color (0-255 per channel) */
  void setLed(uint8_t r, uint8_t g, uint8_t b);

  /** Single buzzer beep */
  void beep(unsigned int durationMs = 200);
};
