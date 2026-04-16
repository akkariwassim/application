import { create } from 'zustand';
import api from '../services/api';

const useAnimalStore = create((set, get) => ({
  animals: [],
  selectedAnimal: null,
  isLoading: false,
  error: null,
  freeDevices: [],

  fetchFreeDevices: async () => {
    try {
      const { data } = await api.get('/devices?status=free');
      set({ freeDevices: data });
      return data;
    } catch (err) {
      console.error('Failed to fetch free devices:', err);
    }
  },

  lastUpdateMap: {},

  fetchAnimals: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/animals');
      // Professional Deduplication & ID Normalization
      const normalized = data.map(a => ({ ...a, id: a.id || a._id }));
      set({ animals: normalized, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load animals', isLoading: false });
    }
  },

  fetchAnimal: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/animals/${id}`);
      set({ selectedAnimal: data, isLoading: false });
      return data;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load animal', isLoading: false });
    }
  },

    try {
      const { data } = await api.post('/animals', animalData);
      const normalized = { ...data, id: data.id || data._id };
      set((state) => {
        // Prevent double entries for the same ID
        const filtered = state.animals.filter(a => a.id !== normalized.id);
        return { animals: [...filtered, normalized] };
      });
      return normalized;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to create animal');
    }

  updateAnimal: async (id, updates) => {
    try {
      const { data } = await api.put(`/animals/${id}`, updates);
      set((state) => ({
        animals: state.animals.map((a) => (a.id === id ? data : a)),
        selectedAnimal: state.selectedAnimal?.id === id ? data : state.selectedAnimal,
      }));
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to update animal');
    }
  },

  deleteAnimal: async (id) => {
    try {
      await api.delete(`/animals/${id}`);
      set((state) => ({
        animals: state.animals.filter((a) => a.id !== id),
      }));
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to delete animal');
    }
  },

  setGeofence: async (animalId, geofenceData) => {
    try {
      const { data } = await api.post(`/animals/${animalId}/geofence`, geofenceData);
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to set geofence');
    }
  },

  triggerAction: async (animalId, type, state) => {
    try {
      const { data } = await api.post(`/animals/${animalId}/action`, { type, state });
      set((stateOld) => ({
        animals: stateOld.animals.map((a) => (a.id === animalId ? { ...a, actuators: data.actuators } : a)),
        selectedAnimal: stateOld.selectedAnimal?.id === animalId ? { ...stateOld.selectedAnimal, actuators: data.actuators } : stateOld.selectedAnimal,
      }));
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to trigger hardware action');
    }
  },

  updateAnimalPosition: (animalId, positionData) => {
    const now = Date.now();
    const last = get().lastUpdateMap[animalId] || 0;
    
    // Performance Throttle: Only update store if it's been 500ms for THIS animal
    if (now - last < 500) return;

    set((state) => ({
      lastUpdateMap: { ...state.lastUpdateMap, [animalId]: now },
      animals: state.animals.map((a) =>
        (a.id === animalId || a._id === animalId)
          ? { 
              ...a, 
              latitude:      positionData.latitude      !== undefined ? positionData.latitude      : a.latitude, 
              longitude:     positionData.longitude     !== undefined ? positionData.longitude     : a.longitude, 
              temperature:   positionData.temperature   !== undefined ? positionData.temperature   : a.temperature,
              heart_rate:    positionData.heart_rate    !== undefined ? positionData.heart_rate    : a.heart_rate,
              battery_level: positionData.battery_level !== undefined ? positionData.battery_level : a.battery_level,
              gps_signal:    positionData.gps_signal    !== undefined ? positionData.gps_signal    : a.gps_signal,
              activity:      positionData.activity      !== undefined ? positionData.activity      : a.activity,
              actuators:     positionData.actuators     !== undefined ? positionData.actuators     : a.actuators,
              last_sync:     positionData.timestamp     || new Date().toISOString(),
              last_seen:     new Date().toISOString()
            }
          : a
      ),
    }));
  },

  /**
   * Batch Update positions for high-density tracking
   * Updates multiple animals in a single commit to reduce re-renders
   */
  batchUpdatePositions: (updates) => {
    set((state) => {
      const newAnimals = [...state.animals];
      const newUpdateMap = { ...state.lastUpdateMap };
      const now = Date.now();

      updates.forEach((update) => {
        const uId = update.animalId || update.id || update._id;
        const idx = newAnimals.findIndex(a => a.id === uId || a._id === uId);
        if (idx !== -1) {
          newAnimals[idx] = { 
            ...newAnimals[idx], 
            ...update, 
            last_sync: update.timestamp || new Date().toISOString(),
            last_seen: new Date().toISOString()
          };
          newUpdateMap[update.animalId] = now;
        }
      });

      return { animals: newAnimals, lastUpdateMap: newUpdateMap };
    });
  },

  updateAnimalStatus: (animalId, status) => {
    set((state) => ({
      animals: state.animals.map((a) =>
        (a.id === animalId || a._id === animalId) ? { ...a, status } : a
      ),
    }));
  },
}));

export default useAnimalStore;
