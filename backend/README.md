# Backend — Smart Virtual Fence System

## Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express 4
- **DB**: MySQL 8 via mysql2
- **Real-time**: Socket.io 4
- **Auth**: JWT (access 15 min + refresh 7 days) + bcrypt
- **Validation**: express-validator
- **Logging**: Winston + Morgan

## Quick Start

```bash
cd backend
cp .env.example .env        # Edit DB credentials and JWT secrets
npm install
npm run dev                 # Starts on http://localhost:3000
```

## API Endpoints

### Auth
| Method | Path                    | Description              |
|--------|-------------------------|--------------------------|
| POST   | /api/auth/register      | Create account           |
| POST   | /api/auth/login         | Get access + refresh JWT |
| POST   | /api/auth/refresh       | Renew access token       |
| POST   | /api/auth/logout        | Revoke refresh token     |
| GET    | /api/auth/me            | Current user profile     |

### Animals
| Method | Path                            | Description         |
|--------|---------------------------------|---------------------|
| GET    | /api/animals                    | List user's animals |
| POST   | /api/animals                    | Create animal       |
| GET    | /api/animals/:id                | Get animal details  |
| PUT    | /api/animals/:id                | Update animal       |
| DELETE | /api/animals/:id                | Delete animal       |
| POST   | /api/animals/:id/geofence       | Set geofence        |
| GET    | /api/animals/:id/geofence       | Get geofence        |

### Positions
| Method | Path                            | Description              |
|--------|---------------------------------|--------------------------|
| POST   | /api/positions                  | Submit GPS reading       |
| GET    | /api/positions/:animalId        | Position history         |
| GET    | /api/positions/:animalId/latest | Latest position          |

### Alerts
| Method | Path                            | Description              |
|--------|---------------------------------|--------------------------|
| GET    | /api/alerts                     | List alerts (filterable) |
| GET    | /api/alerts/:id                 | Alert details            |
| PUT    | /api/alerts/:id/acknowledge     | Mark acknowledged        |
| PUT    | /api/alerts/:id/resolve         | Mark resolved            |
| DELETE | /api/alerts/:id                 | Delete alert             |

### System
| Method | Path        | Description    |
|--------|-------------|----------------|
| GET    | /api/health | Health check   |

## WebSocket Events

### Server → Client
- `position-update`  — `{ animalId, latitude, longitude, speed, ... }`
- `alert-triggered`  — `{ alertId, animalId, type, severity, message }`
- `animal-status-change` — `{ animalId, status }`

### Client → Server
- `subscribe-animal` — `{ animalId }` — subscribe to single animal updates
- `unsubscribe-animal` — `{ animalId }`

## Project Structure
```
src/
├── app.js                 Entry point
├── config/
│   ├── database.js        MySQL2 connection pool
│   └── socket.js          Socket.io server + room management
├── controllers/
│   ├── authController.js
│   ├── animalsController.js
│   ├── positionsController.js
│   └── alertsController.js
├── middleware/
│   ├── auth.js            JWT verification middleware
│   ├── validate.js        express-validator error handler
│   └── errorHandler.js    Global error handler
├── models/
│   ├── User.js
│   ├── Animal.js
│   ├── Position.js
│   ├── Alert.js
│   └── Geofence.js
├── routes/
│   ├── auth.js
│   ├── animals.js
│   ├── positions.js
│   └── alerts.js
├── services/
│   ├── geofenceService.js  Distance & breach detection
│   └── alertService.js     Alert creation & notification
└── utils/
    ├── logger.js           Winston logger
    └── helpers.js          Utility functions
```
