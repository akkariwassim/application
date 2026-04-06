// ============================================================
// Smart Virtual Fence System — ESP32-S3 Main Firmware
// ============================================================
// Hardware:
//   - ESP32-S3 DevKitC-1
//   - NEO-6M GPS (UART1)
//   - SIM800L GPRS (UART2)
//   - Buzzer, Vibration Motor, RGB LED
// ============================================================

#include <Arduino.h>
#include <ArduinoJson.h>

#include "config.h"
#include "secrets.h"
#include "gps.h"
#include "gprs.h"
#include "geofence.h"
#include "alert.h"

// ── Global objects ──────────────────────────────────────────
GpsDriver        gps;
GprsDriver       gprs;
GeofenceDetector geofence;
AlertActuator    alertAct;

// ── State ────────────────────────────────────────────────────
unsigned long lastSendTime    = 0;
bool          gprsConnected   = false;
bool          lastBreachState = false;

// ── Helpers ──────────────────────────────────────────────────

/**
 * Build the JSON payload for POST /api/positions.
 */
String buildPayload(const GpsData& data) {
  JsonDocument doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["animalId"]  = ANIMAL_ID;
  doc["latitude"]  = data.latitude;
  doc["longitude"] = data.longitude;
  doc["accuracy"]  = data.hdop * 5.0; // rough accuracy estimate from HDOP
  doc["speed"]     = data.speed / 3.6; // km/h → m/s
  doc["altitude"]  = data.altitude;
  doc["satellites"] = data.satellites;
  doc["hdop"]      = data.hdop;

  // ISO 8601 timestamp (simplified — no real-time clock)
  char ts[25];
  snprintf(ts, sizeof(ts), "2024-01-01T00:00:00Z"); // Replace with RTC if available
  doc["timestamp"] = ts;

  String output;
  serializeJson(doc, output);
  return output;
}

/**
 * Connect GPRS with retries.
 */
bool ensureGprsConnection() {
  if (gprs.isConnected()) return true;
  for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
    DEBUG_SERIAL.printf("[MAIN] GPRS connect attempt %d/%d\n", attempt + 1, MAX_RETRIES);
    if (gprs.connect()) return true;
    delay(RETRY_DELAY_MS);
  }
  return false;
}

// ── Setup ────────────────────────────────────────────────────
void setup() {
  DEBUG_SERIAL.begin(DEBUG_BAUD);
  delay(500);
  DEBUG_SERIAL.println(F("\n============================================"));
  DEBUG_SERIAL.println(F("  Smart Virtual Fence System — Booting...  "));
  DEBUG_SERIAL.println(F("============================================"));

  alertAct.begin();
  gps.begin();
  gprs.begin();

  // Wait for GPS fix
  alertAct.setLed(0, 0, 255); // Blue = waiting for fix
  if (!gps.waitForFix()) {
    DEBUG_SERIAL.println(F("[MAIN] ⚠ No GPS fix — using last known position"));
  }
  alertAct.setLed(0, 255, 0); // Green = ready

  // Connect GPRS
  gprsConnected = ensureGprsConnection();
  if (!gprsConnected) {
    DEBUG_SERIAL.println(F("[MAIN] ⚠ GPRS unavailable — will retry"));
  }

  DEBUG_SERIAL.println(F("[MAIN] Setup complete. Entering main loop."));
}

// ── Loop ─────────────────────────────────────────────────────
void loop() {
  // Always feed GPS parser
  gps.update();

  unsigned long now = millis();

  // Send position at configured interval
  if (now - lastSendTime >= SEND_INTERVAL_MS || lastSendTime == 0) {
    lastSendTime = now;

    GpsData data = gps.getData();
    if (!data.isValid) {
      DEBUG_SERIAL.println(F("[MAIN] No valid GPS data — skipping send"));
      return;
    }

    // ── Local geofence check ────────────────────────────────
    bool breached = geofence.isBreach(data.latitude, data.longitude);
    if (breached && !lastBreachState) {
      DEBUG_SERIAL.printf("[MAIN] 🚨 BREACH! Distance: %.1fm / Radius: %.1fm\n",
                          geofence.distanceTo(data.latitude, data.longitude),
                          geofence.getParams().radiusM);
      alertAct.triggerBreach();
    } else if (!breached && lastBreachState) {
      DEBUG_SERIAL.println(F("[MAIN] ✅ Animal returned inside geofence"));
      alertAct.setLed(0, 255, 0); // Green = safe
    }
    lastBreachState = breached;

    // ── Transmit via GPRS ──────────────────────────────────
    if (!gprsConnected) gprsConnected = ensureGprsConnection();

    if (gprsConnected) {
      String payload = buildPayload(data);
      DEBUG_SERIAL.println("[MAIN] Sending: " + payload);

      int statusCode = -1;
      for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
        statusCode = gprs.httpPost(POSITION_ENDPOINT, payload);
        if (statusCode == 200 || statusCode == 201) break;
        DEBUG_SERIAL.printf("[MAIN] Retry %d — HTTP %d\n", attempt + 1, statusCode);
        delay(RETRY_DELAY_MS * (attempt + 1)); // Exponential backoff
      }

      if (statusCode != 200 && statusCode != 201) {
        DEBUG_SERIAL.println(F("[MAIN] ⚠ Failed to send position after all retries"));
        gprsConnected = false; // Force reconnect next cycle
      }
    }
  }

  delay(10); // Small yield to RTOS
}
