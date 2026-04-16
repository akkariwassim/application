import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

<<<<<<< HEAD
// ── Robust Dynamic host detection ───────────────────────────────
const getBaseUrl = () => {
  // 1. Explicit override from app.json / extra
  if (Constants.expoConfig?.extra?.API_URL) return Constants.expoConfig.extra.API_URL;
  if (Constants.manifest?.extra?.API_URL) return Constants.manifest.extra.API_URL;

  // 2. Try to find the host machine IP from Expo Packager
  const hostUri = Constants.expoConfig?.hostUri || 
                  Constants.manifest?.debuggerHost || 
                  Constants.manifest2?.extra?.expoGo?.packagerOpts?.hostType;
  
  if (hostUri && typeof hostUri === 'string') {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost') {
      const url = `http://${ip}:3000`;
      console.log(`[API] Detected host IP: ${ip} -> targeting ${url}`);
      return url;
    }
  }

  // 3. Last resort fallbacks
  console.warn('[API] Could not detect host IP, using defaults');
  return 'http://10.0.2.2:3000'; // Works for Android Emulators
};

const API_URL = getBaseUrl() || 'http://localhost:3000'; // Guaranteed non-undefined
=======
const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://192.168.100.152:3000';
>>>>>>> 440470a6bb27bacf6886edd154bcb792cdea0e3a

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach JWT & normalize paths ────────
api.interceptors.request.use(
  async (config) => {
    // 1. Attach JWT token
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Ensure /api prefix
    if (config.url && !config.url.startsWith('/api')) {
      const separator = config.url.startsWith('/') ? '' : '/';
      config.url = `/api${separator}${config.url}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: auto-refresh on 401 ───────────────
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });

        await SecureStore.setItemAsync('accessToken', data.accessToken);
        await SecureStore.setItemAsync('refreshToken', data.refreshToken);

        api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
        processQueue(null, data.accessToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        // Navigation to login is handled in the store
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response) {
      // ── Mute expected 404 on session check (initial load) ─────
      const isMe404 = error.config.url.includes('/auth/me') && error.response.status === 404;

      if (!isMe404) {
        console.error(`[API Error] ${error.config.method?.toUpperCase()} ${error.config.url} - Status: ${error.response.status}`);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.request) {
      console.error(`[Network Error] ${error.config.method?.toUpperCase()} ${error.config.url} - No response received`);
    } else {
      console.error(`[Error] ${error.message}`);
    }

    return Promise.reject(error);
  }
);

export default api;
