import { create } from 'zustand';
import api from '../services/api';

const useStatsStore = create((set, get) => ({
  animalStats: {}, // { animalId: { summary, trends } }
  farmStats: null,
  isLoading: false,
  error: null,

  fetchAnimalStats: async (animalId, period = 'daily') => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get(`/stats/animal/${animalId}`, { params: { period } });
      set(state => ({
        animalStats: { ...state.animalStats, [animalId]: data },
        isLoading: false
      }));
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchFarmStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/stats/farm');
      set({ farmStats: data, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  }
}));

export default useStatsStore;
