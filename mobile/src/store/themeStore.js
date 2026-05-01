import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { LIGHT_COLORS, DARK_COLORS } from '../config/theme';

const useThemeStore = create(
  persist(
    (set, get) => ({
      themeMode: 'system', // 'light' | 'dark' | 'system'
      isDarkMode: Appearance.getColorScheme() === 'dark',
      
      setThemeMode: (mode) => {
        let isDark = false;
        if (mode === 'system') {
          isDark = Appearance.getColorScheme() === 'dark';
        } else {
          isDark = mode === 'dark';
        }
        set({ themeMode: mode, isDarkMode: isDark });
      },
      
      toggleTheme: () => {
        const current = get().themeMode;
        const next = current === 'dark' ? 'light' : 'dark';
        get().setThemeMode(next);
      },
      
      getColors: () => {
        return get().isDarkMode ? DARK_COLORS : LIGHT_COLORS;
      }
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Listen to system changes if in 'system' mode
Appearance.addChangeListener(({ colorScheme }) => {
  const { themeMode, setThemeMode } = useThemeStore.getState();
  if (themeMode === 'system') {
    setThemeMode('system');
  }
});

export default useThemeStore;
