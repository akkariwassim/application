// ============================================================
// Smart Virtual Fence System — GPRS Driver Implementation
// ============================================================

#include "gprs.h"
#include "secrets.h"

GprsDriver::GprsDriver() : _serial(2) {}

void GprsDriver::begin() {
  _serial.begin(GPRS_BAUD, SERIAL_8N1, GPRS_RX_PIN, GPRS_TX_PIN);
  DEBUG_SERIAL.println(F("[GPRS] Initialized SIM800L on UART2"));
}

void GprsDriver::powerCycle() {
  pinMode(GPRS_PWR_PIN, OUTPUT);
  digitalWrite(GPRS_PWR_PIN, LOW);
  delay(1200);
  digitalWrite(GPRS_PWR_PIN, HIGH);
  delay(2000);
  DEBUG_SERIAL.println(F("[GPRS] Power cycle complete"));
}

bool GprsDriver::sendAT(const char* cmd, const char* expected, unsigned int timeoutMs) {
  flushInput();
  _serial.println(cmd);
  DEBUG_SERIAL.print(F("AT>> ")); DEBUG_SERIAL.println(cmd);

  unsigned long start = millis();
  String resp = "";
  while (millis() - start < timeoutMs) {
    while (_serial.available()) resp += (char)_serial.read();
    if (resp.indexOf(expected) != -1) {
      DEBUG_SERIAL.print(F("AT<< ")); DEBUG_SERIAL.println(resp);
      return true;
    }
    delay(10);
  }
  DEBUG_SERIAL.print(F("AT TIMEOUT for: ")); DEBUG_SERIAL.println(cmd);
  return false;
}

String GprsDriver::readResponse(unsigned int timeoutMs) {
  String resp = "";
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (_serial.available()) resp += (char)_serial.read();
  }
  return resp;
}

void GprsDriver::flushInput() {
  while (_serial.available()) _serial.read();
}

bool GprsDriver::connect() {
  DEBUG_SERIAL.println(F("[GPRS] Connecting..."));

  if (!sendAT("AT", "OK", 3000)) { powerCycle(); delay(5000); }
  sendAT("ATE0", "OK");                             // Echo off
  if (!sendAT("AT+CPIN?", "READY", 5000)) {
    DEBUG_SERIAL.println(F("[GPRS] SIM not ready"));
    return false;
  }
  // Wait for network registration
  for (int i = 0; i < 10; i++) {
    if (sendAT("AT+CREG?", "+CREG: 0,1", 3000) ||
        sendAT("AT+CREG?", "+CREG: 0,5", 3000)) break;
    delay(2000);
  }
  // Set APN
  sendAT(("AT+SAPBR=3,1,\"APN\",\"" + String(GPRS_APN) + "\"").c_str(), "OK");
  sendAT(("AT+SAPBR=3,1,\"USER\",\"" + String(GPRS_USER) + "\"").c_str(), "OK");
  sendAT(("AT+SAPBR=3,1,\"PWD\",\"" + String(GPRS_PASS) + "\"").c_str(), "OK");

  if (!sendAT("AT+SAPBR=1,1", "OK", 15000)) {
    DEBUG_SERIAL.println(F("[GPRS] Bearer open failed"));
    return false;
  }
  DEBUG_SERIAL.println(F("[GPRS] Connected to GPRS"));
  return true;
}

bool GprsDriver::isConnected() {
  return sendAT("AT+SAPBR=2,1", "+SAPBR: 1,1", 3000);
}

int GprsDriver::httpPost(const char* endpoint, const String& jsonBody) {
  // Initialize HTTP
  if (!sendAT("AT+HTTPINIT", "OK", 5000)) return -1;

  String urlCmd = "AT+HTTPPARA=\"URL\",\"http://";
  urlCmd += SERVER_HOST;
  urlCmd += ":"; urlCmd += SERVER_PORT;
  urlCmd += endpoint; urlCmd += "\"";

  sendAT(urlCmd.c_str(), "OK");
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK");

  // Authorization header
  String authCmd = "AT+HTTPPARA=\"USERDATA\",\"Authorization: Bearer ";
  authCmd += BEARER_TOKEN; authCmd += "\"";
  sendAT(authCmd.c_str(), "OK");

  // Set content length
  String sizeCmd = "AT+HTTPDATA=" + String(jsonBody.length()) + ",10000";
  if (!sendAT(sizeCmd.c_str(), "DOWNLOAD", 5000)) { sendAT("AT+HTTPTERM", "OK"); return -1; }

  _serial.print(jsonBody);
  delay(500);

  // Send POST
  if (!sendAT("AT+HTTPACTION=1", "+HTTPACTION: 1,", 30000)) { sendAT("AT+HTTPTERM", "OK"); return -1; }

  // Parse status code from "+HTTPACTION: 1,201,..."
  String resp = readResponse(1000);
  int statusCode = -1;
  int idx1 = resp.indexOf("+HTTPACTION: 1,");
  if (idx1 != -1) {
    int idx2 = resp.indexOf(',', idx1 + 15);
    statusCode = resp.substring(idx1 + 15, idx2).toInt();
  }

  sendAT("AT+HTTPTERM", "OK");
  DEBUG_SERIAL.print(F("[GPRS] HTTP POST status: ")); DEBUG_SERIAL.println(statusCode);
  return statusCode;
}
