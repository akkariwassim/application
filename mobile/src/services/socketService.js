import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://192.168.100.152:3000';

let socket = null;

/**
 * Initialize and connect Socket.io client.
 * @param {function} onPositionUpdate   - callback({ animalId, latitude, longitude, ... })
 * @param {function} onAlertTriggered   - callback({ animalId, type, severity, message })
 * @param {function} onStatusChange     - callback({ animalId, status })
 */
export async function connectSocket({
  onPositionUpdate,
  onAlertTriggered,
  onStatusChange,
}) {
  if (socket?.connected) return socket;

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
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
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
