import { create } from 'zustand';
import api from '../services/api';

const useGeofenceStore = create((set, get) => ({
  geofences: [],
  isLoading: false,
  error: null,

  fetchGeofences: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/geofences');
      set({ geofences: data, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  createGeofence: async (geofenceData) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/geofences', geofenceData);
      await get().fetchGeofences();
      return data;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateGeofence: async (id, geofenceData) => {
    try {
      await api.put(`/geofences/${id}`, geofenceData);
      await get().fetchGeofences();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteGeofence: async (id) => {
    try {
      await api.delete(`/geofences/${id}`);
      await get().fetchGeofences();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  setPrimaryZone: async (id) => {
    try {
      // Find the zone to get its data
      const zone = get().geofences.find(z => z.id === id);
      if (!zone) return;
      
      // Update with isPrimary: 1
      await api.put(`/geofences/${id}`, { ...zone, isPrimary: 1 });
      await get().fetchGeofences();
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },
}));

export default useGeofenceStore;
