import { create } from 'zustand';
import api from '../services/api';

const useAnimalStore = create((set, get) => ({
  animals: [],
  selectedAnimal: null,
  isLoading: false,
  error: null,

  fetchAnimals: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/animals');
      set({ animals: data, isLoading: false });
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

  createAnimal: async (animalData) => {
    try {
      const { data } = await api.post('/animals', animalData);
      set((state) => ({ animals: [...state.animals, data] }));
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to create animal');
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

  // ── WebSocket update handlers ──────────────────────────────
  updateAnimalPosition: (animalId, positionData) => {
    set((state) => ({
      animals: state.animals.map((a) =>
        a.id === animalId
          ? { ...a, latitude: positionData.latitude, longitude: positionData.longitude, last_seen: positionData.timestamp }
          : a
      ),
    }));
  },

  updateAnimalStatus: (animalId, status) => {
    set((state) => ({
      animals: state.animals.map((a) =>
        a.id === animalId ? { ...a, status } : a
      ),
    }));
  },
}));

export default useAnimalStore;
