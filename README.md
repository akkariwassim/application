# Smart Virtual Fence System

> An integrated IoT platform for real-time GPS-based livestock monitoring, geofence management, and instant breach alerts.

---

## 🏗 Project Structure

```
smart-virtual-fence/
├── backend/    → Node.js/Express REST API + Socket.io server
├── mobile/     → React Native (Expo) mobile application
├── firmware/   → ESP32-S3 PlatformIO C++ code
├── database/   → MySQL 8 schema and seed data
├── docker-compose.yml
├── ARCHITECTURE.md
└── README.md   ← (you are here)
```

---

## ⚡ Quick Start

### 1. Database

```bash
# Option A: Docker (recommended)
docker-compose up -d db
# Wait ~10s, DB is auto-initialized via schema.sql + sample_data.sql

# Option B: Local MySQL
mysql -u root -p < database/schema.sql
mysql -u root -p < database/sample_data.sql   # optional seed
```

### 2. Backend

```bash
cd backend
cp .env.example .env     # Edit DB credentials and JWT secrets
npm install
npm run dev              # → http://localhost:3000
```

Verify: `curl http://localhost:3000/api/health`

### 3. Mobile

```bash
cd mobile
npm install

# Start Android emulator in Android Studio first, then:
npm run android
```

> **API URL**: The emulator uses `http://10.0.2.2:3000` to reach your local backend.
> For a physical device, update `API_URL` in `mobile/app.json` to your machine's IP.

### 4. Firmware (Optional Hardware)

```bash
# Install PlatformIO CLI or use VS Code extension
cd firmware
# Edit src/config.h  → SERVER_HOST, DEVICE_ID, ANIMAL_ID, pin assignments
# Edit src/secrets.h → APN, BEARER_TOKEN

pio run --target upload
pio device monitor --baud 115200
```

---

## 🔑 Default Test Credentials

| Email           | Password     | Role   |
|-----------------|--------------|--------|
| ahmed@farm.tn   | Password123! | farmer |
| sara@farm.tn    | Password123! | farmer |
| admin@fence.io  | Password123! | admin  |

---

## 🌐 API Overview

Base URL: `http://localhost:3000/api`

| Module    | Endpoints                                           |
|-----------|-----------------------------------------------------|
| Auth      | POST /auth/register, /auth/login, /auth/logout      |
| Animals   | GET/POST /animals, GET/PUT/DELETE /animals/:id      |
| Geofence  | POST /animals/:id/geofence                          |
| Positions | POST /positions, GET /positions/:id/latest          |
| Alerts    | GET /alerts, PUT /alerts/:id/acknowledge            |
| Health    | GET /health                                         |

---

## 📡 Real-time Events (Socket.io)

| Event                | Direction        | Description                    |
|----------------------|------------------|--------------------------------|
| `position-update`    | Server → Client  | New GPS position received      |
| `alert-triggered`    | Server → Client  | Geofence breach alert          |
| `animal-status-change` | Server → Client | Animal status changed         |
| `subscribe-animal`   | Client → Server  | Subscribe to animal updates    |

---

## 🔧 Tech Stack Summary

| Layer    | Technology                             |
|----------|-----------------------------------------|
| Backend  | Node.js 18, Express 4, MySQL2, Socket.io, JWT, bcrypt |
| Mobile   | React Native 0.74, Expo 51, Zustand, Axios, Socket.io-client |
| Firmware | ESP32-S3, PlatformIO, C++11, TinyGPS++, ArduinoJson |
| Database | MySQL 8.0                              |
| DevOps   | Docker Compose                         |
