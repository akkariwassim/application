import { create } from 'zustand';
import api from '../services/api';

const useAnimalStore = create((set, get) => ({
  animals: [],
  socketConnected: false,
  setSocketConnected: (connected) => set({ socketConnected: connected }),
  selectedAnimal: null,
  selectedAnimalAI: null,
  isLoading: false,
  isFetchingMore: false,
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

  // ── Pagination State ──────────────────────────────────────
  page: 1,
  limit: 20,
  hasMore: true,
  total: 0,
  filters: {
    search: '',
    status: null,
    type: null,
    zone_id: null,
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  stats: {
    total: 0,
    safe: 0,
    warning: 0,
    danger: 0,
    offline: 0
  },
  availableDevices: [],

  fetchAvailableDevices: async () => {
    try {
      const { data } = await api.get('/devices', { params: { status: 'free' } });
      set({ availableDevices: data });
    } catch (err) {
      console.error('Failed to fetch devices:', err.message);
    }
  },

  fetchAnimals: async (isNextPage = false) => {
    const { page, limit, filters, animals, hasMore } = get();
    if (isNextPage && !hasMore) return;

    if (!isNextPage) {
      set({ isLoading: true, error: null, page: 1, animals: [] });
    } else {
      set({ isFetchingMore: true });
    }

    try {
      const currentPage = isNextPage ? page + 1 : 1;
      const { data } = await api.get('/animals', {
        params: { ...filters, page: currentPage, limit }
      });

      set({
        animals: isNextPage ? [...animals, ...data.animals] : data.animals,
        total: data.pagination.total,
        stats: data.stats || get().stats, // Use stats from backend if available
        page: currentPage,
        hasMore: data.pagination.hasMore,
        isLoading: false,
        isFetchingMore: false
      });
    } catch (err) {
      set({ 
        error: err.response?.data?.error || 'Failed to load animals', 
        isLoading: false, 
        isFetchingMore: false 
      });
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({ filters: { ...state.filters, ...newFilters } }));
    get().fetchAnimals(); // Refresh from page 1
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

  fetchAIAnalysis: async (animalId) => {
    set({ selectedAnimalAI: null });
    try {
      const { data } = await api.get(`/ai/animal/${animalId}`);
      set({ selectedAnimalAI: data });
      return data;
    } catch (err) {
      console.warn('AI analysis not found for this animal');
      set({ selectedAnimalAI: null });
    }
  },

  // ... (create/update/delete remain similar but can trigger re-fetch if needed)
  createAnimal: async (animalData) => {
    try {
      const { data } = await api.post('/animals', animalData);
      set((state) => ({ 
        animals: [data, ...state.animals], 
        total: state.total + 1,
        stats: { ...state.stats, total: state.stats.total + 1, [data.status || 'safe']: (state.stats[data.status || 'safe'] || 0) + 1 }
      }));
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to create animal');
    }
  },

  updateAnimal: async (id, updates) => {
    try {
      const { data } = await api.put(`/animals/${id}`, updates);
      set((state) => ({
        animals: state.animals.map((a) => (a.id === id ? data : a)),
        selectedAnimal: state.selectedAnimal?.id === id ? data : state.selectedAnimal,
      }));
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to update animal');
    }
  },

  deleteAnimal: async (id) => {
    const animalToDelete = get().animals.find(a => a.id === id);
    if (!animalToDelete) return;

    // Optimistic delete
    const previousAnimals = get().animals;
    set({ 
      animals: previousAnimals.filter((a) => a.id !== id),
      lastDeletedAnimal: animalToDelete 
    });

    try {
      await api.delete(`/animals/${id}`);
      // Clear undo reference after 5 seconds
      setTimeout(() => {
        if (get().lastDeletedAnimal?.id === id) {
          set({ lastDeletedAnimal: null });
        }
      }, 5000);
    } catch (err) {
      set({ animals: previousAnimals, lastDeletedAnimal: null });
      throw err;
    }
  },

  restoreAnimal: async () => {
    const animal = get().lastDeletedAnimal;
    if (!animal) return;

    try {
      // Re-create in backend (simplified restore)
      const res = await api.post('/animals', {
        ...animal,
        deviceId: animal.device_id,
        rfidTag: animal.rfid_tag,
        weightKg: animal.weight_kg,
        currentZoneId: animal.current_zone_id
      });
      set(state => ({
        animals: [res.data, ...state.animals],
        lastDeletedAnimal: null
      }));
    } catch (err) {
      console.error('Failed to restore animal:', err.message);
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
              latitude: positionData.latitude, 
              longitude: positionData.longitude, 
              temperature: positionData.temperature,
              heart_rate: positionData.heartRate || positionData.heart_rate,
              battery_level: positionData.batteryLevel || positionData.battery_level,
              signal_strength: positionData.signalStrength || positionData.signal_strength,
              activity: positionData.activity,
              last_seen: positionData.timestamp || new Date() 
            }
          : a
      ),
    }));
  },

  batchUpdatePositions: (batch) => {
    const updatesMap = new Map(batch.map(item => [item.animalId, item]));
    set((state) => ({
      animals: state.animals.map(a => {
        const up = updatesMap.get(a.id);
        if (!up) return a;
        return { 
          ...a, 
          latitude: up.latitude, 
          longitude: up.longitude,
          temperature: up.temperature,
          heart_rate: up.heartRate || up.heart_rate,
          battery_level: up.batteryLevel || up.battery_level,
          signal_strength: up.signalStrength || up.signal_strength,
          activity: up.activity,
          last_seen: up.timestamp || new Date()
        };
      })
    }));
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
