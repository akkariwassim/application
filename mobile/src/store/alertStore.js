import { create } from 'zustand';
import api from '../services/api';

const useAlertStore = create((set, get) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,

  fetchAlerts: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.status)   params.append('status',   filters.status);
      if (filters.animalId) params.append('animalId', filters.animalId);
      if (filters.type)     params.append('type',     filters.type);
      
      const { data } = await api.get(`/alerts?${params.toString()}`);
      
      // Client-side sorting (newest first by default)
      const sorted = [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      const unreadCount = sorted.filter((a) => a.status === 'active').length;
      set({ alerts: sorted, unreadCount, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  acknowledgeAlert: async (id) => {
    try {
      const { data } = await api.put(`/alerts/${id}/acknowledge`);
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? data : a)),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to acknowledge');
    }
  },

  resolveAlert: async (id) => {
    try {
      const { data } = await api.put(`/alerts/${id}/resolve`);
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? data : a)),
      }));
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to resolve');
    }
  },

  deleteAlert: async (id) => {
    try {
      await api.delete(`/alerts/${id}`);
      set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id),
      }));
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to delete');
    }
  },

  // Called by WebSocket
  addAlert: (alert) => {
    set((state) => ({
      alerts: [alert, ...state.alerts],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));

export default useAlertStore;
