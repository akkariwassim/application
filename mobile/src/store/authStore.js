import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  // ── Initialize: check stored tokens ───────────────────────
  init: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
      const { data } = await api.get('/auth/me');
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  // ── Login ─────────────────────────────────────────────────
  login: async (email, password) => {
    set({ error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await SecureStore.setItemAsync('accessToken', data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken);
      set({ user: data.user, isAuthenticated: true });
      return true;
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed';
      set({ error: message });
      return false;
    }
  },

  // ── Register ──────────────────────────────────────────────
  register: async ({ name, email, password, phone }) => {
    set({ error: null });
    try {
      const { data } = await api.post('/auth/register', { name, email, password, phone });
      await SecureStore.setItemAsync('accessToken', data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken);
      set({ user: data.user, isAuthenticated: true });
      return true;
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed';
      set({ error: message });
      return false;
    }
  },

  // ── Logout ────────────────────────────────────────────────
  logout: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    set({ user: null, isAuthenticated: false });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
