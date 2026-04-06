# Architecture — Smart Virtual Fence System

## System Overview

```
                          ┌──────────────────────────────────────┐
                          │          Farmer's Smartphone          │
                          │   ┌─────────────────────────────┐    │
                          │   │  React Native App (Expo 51) │    │
                          │   │  • Live Map (Google Maps)   │    │
                          │   │  • Alert Notifications      │    │
                          │   │  • Animal Management        │    │
                          │   └───────────┬─────────────────┘    │
                          └──────────────┼──────────────────────-┘
                                         │ HTTP REST + WebSocket
                                         │ (JWT Bearer Token)
                          ┌──────────────▼──────────────────────-┐
                          │       Backend Server (Node.js)        │
                          │   ┌──────────┐  ┌──────────────────┐ │
                          │   │ REST API │  │   Socket.io      │ │
                          │   │ Express  │  │ (Real-time push) │ │
                          │   └────┬─────┘  └──────────────────┘ │
                          │        │ mysql2                        │
                          │   ┌────▼──────────────────────────┐   │
                          │   │       MySQL 8.0 Database       │   │
                          │   │  users, animals, positions,    │   │
                          │   │  geofences, alerts             │   │
                          │   └───────────────────────────────┘   │
                          └──────────────▲──────────────────────-─┘
                                         │ HTTP POST /api/positions
                                         │ (Bearer Token, JSON)
                          ┌──────────────┴──────────────────────-─┐
                          │      ESP32-S3 Firmware (PlatformIO)    │
                          │  ┌──────────┐  ┌──────────────────┐   │
                          │  │ NEO-6M   │  │    SIM800L       │   │
                          │  │ GPS UART │  │  GPRS/2G HTTP    │   │
                          │  └──────────┘  └──────────────────┘   │
                          │  ┌────────────────────────────────┐   │
                          │  │ Geofence Breach Detection      │   │
                          │  │ • Haversine distance formula   │   │
                          │  │ • Buzzer + Vibration + LED     │   │
                          │  └────────────────────────────────┘   │
                          └────────────────────────────────────-──┘
```

---

## Data Flow: Animal Breach Event

```
1. ESP32 reads GPS (NEO-6M, 1Hz)
2. Haversine distance > geofence radius
3. Firmware: triggers buzzer + vibration + LED RED
4. Firmware: sends POST /api/positions with {lat, lon, deviceId}
5. Backend: looks up animal by deviceId
6. Backend: queries active geofence for that animal
7. Backend: recalculates Haversine — confirms breach
8. Backend: INSERT into alerts table (type=geofence_breach, severity=critical)
9. Backend: UPDATE animals SET status='danger'
10. Backend: io.to(`user:${userId}`).emit('alert-triggered', {...})
11. Mobile App: Socket receives 'alert-triggered'
12. Mobile App: Updates Zustand alertStore (addAlert)
13. Mobile App: Red marker appears on map, badge count increments
14. Farmer: taps notification → opens AlertsScreen → acknowledges
```

---

## Security Architecture

| Layer     | Mechanism                                                     |
|-----------|---------------------------------------------------------------|
| Auth      | JWT Access Token (15 min) + Refresh Token (7 days, hashed)   |
| Transport | HTTPS in production (HTTP for local dev)                      |
| Storage   | Tokens stored in Expo SecureStore (Keychain/Keystore)         |
| Passwords | bcrypt (10 rounds)                                            |
| Rate Limit| 200 req/15min per IP via express-rate-limit                   |
| Headers   | Helmet.js security headers                                    |
| Validation| express-validator on all inputs                               |

---

## Database Schema

```
users ──< animals ──< positions
              │
              └──< geofences
              │
              └──< alerts >── users
```

---

## Module Responsibilities

| Module   | Responsibility                                       |
|----------|------------------------------------------------------|
| Firmware | GPS acquisition, geofence check, HTTP POST, alerts   |
| Backend  | Authentication, geofence validation, alert creation, WS push |
| Mobile   | Real-time map, alert management, CRUD, history charts|
| Database | Persistent storage with spatial-ready indices         |
