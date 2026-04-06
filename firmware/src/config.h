#pragma once
// ============================================================
// Smart Virtual Fence System — Firmware Configuration
// Edit these values to match your hardware wiring and network
// ============================================================

// ── GPIO Pins ────────────────────────────────────────────────
// GPS (NEO-6M) — UART1
#define GPS_RX_PIN      16
#define GPS_TX_PIN      17
#define GPS_BAUD        9600

// GPRS (SIM800L) — UART2
#define GPRS_RX_PIN     18
#define GPRS_TX_PIN     19
#define GPRS_BAUD       9600
#define GPRS_PWR_PIN    4   // Power key (pulse LOW to toggle)

// Alert actuators
#define BUZZER_PIN      25
#define VIBRATION_PIN   26
#define LED_R_PIN       32
#define LED_G_PIN       33
#define LED_B_PIN       27

// ── Backend Server ───────────────────────────────────────────
#define SERVER_HOST     "your-server-ip-or-domain"
#define SERVER_PORT     3000
#define POSITION_ENDPOINT "/api/positions"

// ── Device Identity ──────────────────────────────────────────
#define DEVICE_ID       "ESP32_001"

// Animal ID on the backend (set to 0 to auto-resolve by deviceId)
#define ANIMAL_ID       1

// ── Transmission ─────────────────────────────────────────────
// How often to send position data (milliseconds)
#define SEND_INTERVAL_MS     60000UL   // 60 seconds

// Retry on failure
#define MAX_RETRIES          3
#define RETRY_DELAY_MS       5000UL

// ── Geofence Defaults ────────────────────────────────────────
// Used if server is unreachable — local fallback
#define DEFAULT_GF_LAT       35.0380f
#define DEFAULT_GF_LON        9.4845f
#define DEFAULT_GF_RADIUS_M  500.0f

// ── Serial Debug ─────────────────────────────────────────────
#define DEBUG_SERIAL         Serial
#define DEBUG_BAUD           115200

// ── Misc ─────────────────────────────────────────────────────
#define GPS_FIX_TIMEOUT_S    120    // Max seconds to wait for first GPS fix
#define GPS_HISTORY_SIZE     10     // Number of last positions kept in RAM
