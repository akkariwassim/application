#pragma once
// ============================================================
// Smart Virtual Fence System — GPRS Driver (SIM800L)
// ============================================================

#include <Arduino.h>
#include <HardwareSerial.h>
#include "config.h"

class GprsDriver {
public:
  GprsDriver();

  /** Initialize UART for SIM800L */
  void begin();

  /** Power cycle the module */
  void powerCycle();

  /** Connect to GPRS network */
  bool connect();

  /** Check if GPRS is connected */
  bool isConnected();

  /**
   * Send HTTP POST request with JSON body.
   * @param endpoint  e.g. "/api/positions"
   * @param jsonBody  JSON string
   * @returns HTTP status code, or -1 on failure
   */
  int httpPost(const char* endpoint, const String& jsonBody);

private:
  HardwareSerial _serial;

  bool sendAT(const char* cmd, const char* expected = "OK", unsigned int timeoutMs = 5000);
  String readResponse(unsigned int timeoutMs = 3000);
  void flushInput();
};
