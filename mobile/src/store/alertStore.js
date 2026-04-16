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
      
      let processed = [...data];
      
      // 1. Text Search (if search query exists)
      if (filters.search) {
        const query = filters.search.toLowerCase();
        processed = processed.filter(a => 
          a.message?.toLowerCase().includes(query) || 
          a.animal_name?.toLowerCase().includes(query) ||
          a.type?.toLowerCase().includes(query)
        );
      }

      // 2. Intelligent Sorting: 
      // Rule A: Critical severity first
      // Rule B: By date (newest first)
      processed.sort((a, b) => {
        const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
        const rankA = severityRank[a.severity] || 0;
        const rankB = severityRank[b.severity] || 0;
        
        if (rankA !== rankB) return rankB - rankA;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      
      const unreadCount = processed.filter((a) => a.status === 'active' || a.status === 'new').length;
      set({ alerts: processed, unreadCount, isLoading: false });
    } catch (err) {
      console.error('[AlertStore] Fetch Error:', err);
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

  // Called by WebSocket - Professional Deduplication
  addAlert: (alert) => {
    const normalized = { ...alert, id: alert.id || alert._id };
    set((state) => {
      // Prevent duplicate socket entries (e.g. if already fetched via API)
      const exists = state.alerts.find(a => (a.id === normalized.id || a._id === normalized.id));
      if (exists) return state;

      const newAlerts = [normalized, ...state.alerts];
      
      // Maintain sort order even on live injection
      newAlerts.sort((a, b) => {
        const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
        const rankA = severityRank[a.severity] || 0;
        const rankB = severityRank[b.severity] || 0;
        if (rankA !== rankB) return rankB - rankA;
        return new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now());
      });

      return {
        alerts: newAlerts,
        unreadCount: state.unreadCount + 1,
      };
    });
  },
}));

export default useAlertStore;
