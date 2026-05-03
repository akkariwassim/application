import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// We'll require syncService dynamically to avoid circular dependencies

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
      console.log(`[API] Detected host IP: ${ip} -> targeting ${url}`);
      return url;
    }
  }

  // 2. Explicit override from app.json / extra (Fallback)
  if (Constants.expoConfig?.extra?.API_URL) return Constants.expoConfig.extra.API_URL;
  if (Constants.manifest?.extra?.API_URL) return Constants.manifest.extra.API_URL;

  // 3. Last resort fallbacks
  console.warn('[API] Could not detect host IP, using defaults');
  return 'http://10.0.2.2:3000'; // Works for Android Emulators
};

const API_URL = getBaseUrl() || 'http://localhost:3000'; // Guaranteed non-undefined

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

    // 2. Attach Farm Context (Multi-tenancy)
    const farmId = await SecureStore.getItemAsync('currentFarmId');
    if (farmId) {
      config.headers['x-farm-id'] = farmId;
    }

    // 3. Ensure /api prefix
    if (config.url && !config.url.startsWith('/api')) {
      const separator = config.url.startsWith('/') ? '' : '/';
      config.url = `/api${separator}${config.url}`;
    }

    // 4. Attach unique request ID for tracing
    config.headers['x-request-id'] = Math.random().toString(36).substring(2, 11).toUpperCase();

    // 5. Safety Guard: Block requests with 'undefined' in URL
    if (config.url && config.url.includes('/undefined')) {
      console.error(`[API Guard] Blocked invalid request: ${config.method?.toUpperCase()} ${config.url}`);
      return Promise.reject(new Error('INVALID_URL_UNDEFINED'));
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
  (response) => {
    // If the backend followed the { success: true, data: ... } standard, unwrap it
    if (response.data && response.data.success === true && response.data.data !== undefined) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // ── 1. Retry Logic for Network/Transient Errors ───────────
    const isRetryable = !error.response || (error.response.status >= 500 && error.response.status <= 599);
    originalRequest._retryCount = originalRequest._retryCount || 0;

    if (isRetryable && originalRequest._retryCount < 3) {
      originalRequest._retryCount++;
      const delay = originalRequest._retryCount * 1000; // Exponential backoff
      console.log(`[API] Retrying ${originalRequest.url} (Attempt ${originalRequest._retryCount}) in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(originalRequest);
    }

    // ── 2. JWT Auto-Refresh (401) ─────────────────────────────
    if (error.response?.status === 401 && !originalRequest._isRefreshing) {
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

      originalRequest._isRefreshing = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data: wrapper } = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });

        // Handle standardized wrapper if present
        const data = (wrapper.success && wrapper.data) ? wrapper.data : wrapper;

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
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── 3. Offline Queuing for Mutations ──────────────────────
    const isMutation = ['post', 'put', 'delete', 'patch'].includes(error.config.method?.toLowerCase());
    const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error';

    if (isMutation && isNetworkError) {
      console.log(`[API] Connection lost during mutation. Queuing: ${error.config.url}`);
      const { queueAction } = require('./syncService');
      await queueAction({
        method: error.config.method,
        url: error.config.url,
        data: error.config.data ? JSON.parse(error.config.data) : null,
        params: error.config.params
      });
      // Return a "fake" success or a special offline response to the store
      return Promise.resolve({ data: { success: true, offline: true } });
    }

    // ── 4. Diagnostic Logging ─────────────────────────────────
    if (error.response) {
      const isMe404 = error.config.url.includes('/auth/me') && error.response.status === 404;
      const isAI404 = error.config.url.includes('/ai/animal/') && error.response.status === 404;

      if (!isMe404 && !isAI404) {
        console.error(`[API Error] ${error.config.method?.toUpperCase()} ${error.config.url} - Status: ${error.response.status}`);
      }
    } else if (error.request) {
      console.error(`[Network Error] ${error.config.method?.toUpperCase()} ${error.config.url} - No response`);
    }

    return Promise.reject(error);
  }
);

/**
 * Standardizes error messages from the backend or network.
 */
export const getErrorMessage = (error) => {
  if (error.response) {
    const data = error.response.data;
    return data.message || data.error || `Erreur serveur (${error.response.status})`;
  } else if (error.request) {
    return 'Le serveur est injoignable. Vérifiez votre connexion.';
  }
  return error.message || 'Une erreur inconnue est survenue.';
};

export default api;
