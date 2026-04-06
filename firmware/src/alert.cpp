// ============================================================
// Smart Virtual Fence System — Alert Actuators Implementation
// ============================================================

#include "alert.h"

AlertActuator::AlertActuator() {}

void AlertActuator::begin() {
  pinMode(BUZZER_PIN,    OUTPUT);
  pinMode(VIBRATION_PIN, OUTPUT);
  pinMode(LED_R_PIN,     OUTPUT);
  pinMode(LED_G_PIN,     OUTPUT);
  pinMode(LED_B_PIN,     OUTPUT);
  clear(); // Start with all off
  // Startup blink: brief green
  setLed(0, 255, 0); delay(300); clear();
}

void AlertActuator::triggerBreach() {
  // LED: RED
  setLed(255, 0, 0);

  // Buzzer: 3 bips × 200ms with 100ms gap
  for (int i = 0; i < 3; i++) {
    beep(200);
    delay(100);
  }

  // Vibration: 500ms continuous
  digitalWrite(VIBRATION_PIN, HIGH);
  delay(500);
  digitalWrite(VIBRATION_PIN, LOW);

  DEBUG_SERIAL.println(F("[ALERT] Breach actuators triggered"));
}

void AlertActuator::clear() {
  digitalWrite(BUZZER_PIN,    LOW);
  digitalWrite(VIBRATION_PIN, LOW);
  setLed(0, 0, 0);
}

void AlertActuator::setLed(uint8_t r, uint8_t g, uint8_t b) {
  // Using analogWrite for PWM (common-cathode RGB LED)
  analogWrite(LED_R_PIN, r);
  analogWrite(LED_G_PIN, g);
  analogWrite(LED_B_PIN, b);
}

void AlertActuator::beep(unsigned int durationMs) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(durationMs);
  digitalWrite(BUZZER_PIN, LOW);
}
