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
      const { data: userData } = await api.get('/api/auth/me');
      
      // Attempt to restore farm context if not set
      let farmId = await SecureStore.getItemAsync('activeFarmId');
      if (!farmId && userData.memberships && userData.memberships.length > 0) {
        farmId = userData.memberships[0].farm_id;
        await SecureStore.setItemAsync('activeFarmId', farmId);
      }

      set({ user: userData, isAuthenticated: true, isLoading: false });
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
      const { data: loginData } = await api.post('/api/auth/login', { email, password });
      await SecureStore.setItemAsync('accessToken', loginData.accessToken);
      await SecureStore.setItemAsync('refreshToken', loginData.refreshToken);
      
      if (loginData.farmId) {
        await SecureStore.setItemAsync('activeFarmId', loginData.farmId);
      }

      set({ user: loginData.user, isAuthenticated: true });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Login failed';
      set({ error: message });
      return false;
    }
  },

  // ── Register ──────────────────────────────────────────────
  register: async ({ name, email, password, phone }) => {
    set({ error: null });
    try {
      const { data: regData } = await api.post('/api/auth/register', { name, email, password, phone });
      await SecureStore.setItemAsync('accessToken', regData.accessToken);
      await SecureStore.setItemAsync('refreshToken', regData.refreshToken);

      if (regData.farmId) {
        await SecureStore.setItemAsync('activeFarmId', regData.farmId);
      }

      set({ user: regData.user, isAuthenticated: true });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Registration failed';
      set({ error: message });
      return false;
    }
  },

  // ── Logout ────────────────────────────────────────────────
  logout: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      await api.post('/api/auth/logout', { refreshToken });
    } catch {}
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('activeFarmId');
    set({ user: null, isAuthenticated: false });
  },

  // ── Update Profile Name ──────────────────────────────────
  updateProfileName: async (name) => {
    set({ error: null });
    try {
      const { data } = await api.put('/api/user/update-name', { name });
      set({ user: data.user });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || 'Nom non mis à jour.';
      set({ error: message });
      return false;
    }
  },

  // ── Change Password ───────────────────────────────────────
  changeUserPassword: async (currentPassword, newPassword) => {
    set({ error: null });
    try {
      await api.put('/api/user/change-password', { currentPassword, newPassword });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || 'Le changement a échoué.';
      set({ error: message });
      return false;
    }
  },

  // ── Update Profile Phone ─────────────────────────────────
  updateProfilePhone: async (phone) => {
    set({ error: null });
    try {
      const { data } = await api.put('/api/user/update-phone', { phone });
      set({ user: data.user });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || 'Numéro non mis à jour.';
      set({ error: message });
      return false;
    }
  },

  // ── Unified Profile Update ────────────────────────────────
  updateUserProfile: async (profileData) => {
    set({ error: null });
    try {
      const { data } = await api.put('/api/user/update-profile', profileData);
      if (data.user) set({ user: data.user });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Mise à jour du profil échouée';
      set({ error: message });
      return false;
    }
  },

  // ── Update Farm Location ─────────────────────────────────
  updateFarmLocation: async (latitude, longitude, name) => {
    set({ error: null });
    try {
      const { data } = await api.put('/api/user/update-farm', { latitude, longitude, name });
      if (data.user) set({ user: data.user });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Mise à jour de la ferme échouée';
      set({ error: message });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
