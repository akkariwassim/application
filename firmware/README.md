# Firmware — Smart Virtual Fence System (ESP32-S3)

## Hardware Requirements

| Component       | Model         | Notes                    |
|-----------------|---------------|--------------------------|
| Microcontroller | ESP32-S3      | DevKitC-1                |
| GPS Module      | NEO-6M (UBLOX)| UART1, 9600 baud         |
| GPRS Module     | SIM800L       | UART2, 9600 baud, 2G SIM |
| Buzzer          | Piezo         | GPIO 25                  |
| Vibration Motor | DC Motor      | GPIO 26 via transistor   |
| RGB LED         | Common-cathode | GPIO 32/33/27            |
| Battery         | Li-Po 3.7V 2000mAh | via TP4056 charger  |

## Wiring

```
NEO-6M TX  → ESP32 GPIO 16 (RX)
NEO-6M RX  → ESP32 GPIO 17 (TX)
SIM800L TX → ESP32 GPIO 18 (RX)
SIM800L RX → ESP32 GPIO 19 (TX)
SIM800L PWR_KEY → GPIO 4
Buzzer     → GPIO 25 (+ 100Ω resistor)
Vibration  → GPIO 26 (via NPN transistor)
LED R/G/B  → GPIO 32/33/27 (via 220Ω resistors)
```

## Setup

### 1. Install PlatformIO
```bash
pip install platformio
# Or use the PlatformIO IDE extension for VS Code
```

### 2. Configure
```bash
cp src/secrets.h.example src/secrets.h  # (or edit secrets.h directly)
# Edit src/secrets.h: set APN, BEARER_TOKEN
# Edit src/config.h:  set SERVER_HOST, DEVICE_ID, ANIMAL_ID, GPIO pins
```

### 3. Build & Flash
```bash
cd firmware
pio run                             # Build
pio run --target upload             # Flash to ESP32
pio device monitor --baud 115200    # Serial monitor
```

## Operation Flow
1. **Boot** → Initialize peripherals, LED = Blue
2. **Wait for GPS fix** (up to 2 min) → LED = Green when ready
3. **Connect GPRS** → Opens bearer with carrier APN
4. **Every 60s** → Read GPS, check geofence, POST to backend
5. **Breach detected** → Buzzer beeps, motor vibrates, LED = Red
6. **Return inside** → LED = Green, no alert

## Energy Saving
- Between transmissions, the ESP32 can enter light sleep (`esp_sleep_enable_timer_wakeup`) for further battery optimization.
- Estimated autonomy: **48–72 hours** at 60s intervals.

## Troubleshooting

| Symptom                | Likely Cause               | Fix                         |
|------------------------|----------------------------|-----------------------------|
| No GPS data            | Weak signal indoors         | Move to open sky            |
| GPRS fails             | Wrong APN / SIM not active  | Update `secrets.h`          |
| HTTP 401               | Invalid bearer token        | Regenerate JWT in backend   |
| HTTP 404               | Wrong DEVICE_ID             | Match `config.h` to DB      |
