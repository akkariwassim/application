import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * STORE: Persistent Map Settings
 * Handles location locking, saved viewpoints, and map preferences.
 */
const useMapStore = create(
  persist(
    (set, get) => ({
      isLocked: false,
      lockedLocation: null, // { latitude, longitude, label }
      mapType: 'hybrid',
      followUser: true,
      
      setLockedLocation: (coords, label = 'Position Verrouillée') => {
        set({ 
          lockedLocation: { ...coords, label }, 
          isLocked: true,
          followUser: false
        });
      },

      unlockLocation: () => {
        set({ isLocked: false, followUser: true });
      },

      setFollowUser: (follow) => set({ followUser: follow }),

      toggleLock: () => {
        const { isLocked, lockedLocation } = get();
        if (isLocked) {
          set({ isLocked: false, followUser: true });
        } else if (lockedLocation) {
          set({ isLocked: true, followUser: false });
        }
      },

      setMapType: (type) => set({ mapType: type }),

      clearMapSettings: () => set({ 
        isLocked: false, 
        lockedLocation: null,
        followUser: true
      }),
    }),
    {
      name: 'map-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useMapStore;
