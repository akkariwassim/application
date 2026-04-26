import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ── Robust Dynamic host detection ───────────────────────────────
const getBaseUrl = () => {
  // 1. Try to find the host machine IP from Expo Packager (MANDATORY for physical devices)
  const hostUri = Constants.expoConfig?.hostUri || 
                  Constants.manifest?.debuggerHost || 
                  Constants.manifest2?.extra?.expoGo?.packagerOpts?.hostType;
  
  if (hostUri && typeof hostUri === 'string') {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost') {
      const url = `http://${ip}:3000`;
      console.log(`[Socket] Detected host IP: ${ip} -> targeting ${url}`);
      return url;
    }
  }

  // 2. Fallback to app.json
  if (Constants.expoConfig?.extra?.API_URL) return Constants.expoConfig.extra.API_URL;
  if (Constants.manifest?.extra?.API_URL) return Constants.manifest.extra.API_URL;

  return 'http://10.0.2.2:3000';
};

const API_URL = getBaseUrl() || 'http://localhost:3000';

let socket = null;

/**
 * @param {function} onConnect          - callback()
 * @param {function} onDisconnect       - callback()
 * @param {function} onPositionUpdate   - callback({ animalId, latitude, longitude, ... })
 * @param {function} onAlertTriggered   - callback({ animalId, type, severity, message })
 * @param {function} onStatusChange     - callback({ animalId, status })
 */
export async function connectSocket({
  onConnect,
  onDisconnect,
  onPositionUpdate,
  onAlertTriggered,
  onStatusChange,
  onZoneStatusChange,
}) {
  if (socket?.connected) {
    if (onConnect) onConnect();
    return socket;
  }

  const token = await SecureStore.getItemAsync('accessToken');

  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    if (onConnect) onConnect();
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
    if (onDisconnect) onDisconnect();
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  if (onPositionUpdate) {
    socket.on('position-update', (data) => {
      onPositionUpdate(data);
    });
  }

  if (onAlertTriggered) {
    socket.on('alert-triggered', (data) => {
      onAlertTriggered(data);
    });
  }

  if (onStatusChange) {
    socket.on('animal-status-change', (data) => {
      onStatusChange(data);
    });
  }

  if (onZoneStatusChange) {
    socket.on('zone-status-change', (data) => {
      onZoneStatusChange(data);
    });
  }

  return socket;
}

/**
 * Subscribe to updates for a specific animal.
 */
export function subscribeAnimal(animalId) {
  socket?.emit('subscribe-animal', { animalId });
}

/**
 * Unsubscribe from updates for a specific animal.
 */
export function unsubscribeAnimal(animalId) {
  socket?.emit('unsubscribe-animal', { animalId });
}

/**
 * Disconnect and clean up.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
