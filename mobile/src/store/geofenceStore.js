import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const useGeofenceStore = create(
  persist(
    (set, get) => ({
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

  /**
   * Called by WebSocket to update a specific zone's status in real-time.
   */
  updateZoneStatus: (data) => {
    const { zoneId, status, color, reason, timestamp } = data;
    set((state) => ({
      geofences: state.geofences.map((gf) => 
        (gf.id === zoneId || gf._id === zoneId)
          ? { 
              ...gf, 
              status, 
              status_color: color, 
              status_reason: reason, 
              last_status_update: timestamp 
            }
          : gf
      ),
    }));
  },
  }),
    {
      name: 'geofence-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        geofences: state.geofences 
      }),
    }
  )
);

export default useGeofenceStore;
