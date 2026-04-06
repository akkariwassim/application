# Mobile — Smart Virtual Fence System

## Tech Stack
- **Expo** SDK 51 + React Native 0.74
- **Navigation**: React Navigation v6 (Stack + Bottom Tabs)
- **State**: Zustand
- **Maps**: react-native-maps (Google Maps provider)
- **Real-time**: Socket.io-client
- **Forms**: Formik + Yup
- **HTTP**: Axios with JWT auto-refresh

## Quick Start

```bash
cd mobile
npm install

# Start Metro bundler (Android emulator must be running)
npm run android

# Or for iOS
npm run ios
```

## Configuration

The backend URL is configured in `app.json`:
```json
"extra": {
  "API_URL": "http://10.0.2.2:3000"
}
```

> `10.0.2.2` is the Android emulator's alias for localhost.
> For a real device, use your machine's local IP (e.g. `http://192.168.1.x:3000`).

## Screens

| Screen         | Description                                              |
|----------------|----------------------------------------------------------|
| Login          | JWT authentication with validation                       |
| Register       | New account with strong password validation              |
| Live Map       | Real-time Google Map with animal markers + geofences     |
| Alerts         | Filterable alert list with acknowledge/resolve actions   |
| Animals        | CRUD list with status indicators                         |
| Animal Detail  | Create/edit form with geofence configuration             |
| History        | Map trajectory + distance/speed stats + position list   |
| Profile        | User info, notification settings, sign out              |

## Known Platform Notes
- Google Maps requires a valid API key in `app.json` for production builds
- Push notifications require Expo EAS or FCM credentials for real devices
