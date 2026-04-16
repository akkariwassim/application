import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * Premium 2026 Design System - Smart Fence Pro
 * Colors: Deep Ocean Dark Mode, Neon Accents, Glassmorphism tokens
 */
export const COLORS = {
  // Brand
  primary: '#6366F1',     // Indigo
  primaryLight: '#818CF8',
  secondary: '#10B981',   // Emerald
  
  // Base
  background: '#040712',  // Deepest Navy
  surface: '#0A0F1E',     // Deep Navy
  card: '#131929',        // Navy Card
  cardLight: '#1E293B',
  
  // Accents / Status
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  
  // Neutral
  white: '#FFFFFF',
  text: '#F8FAFC',        // Slate 50
  textMuted: '#94A3B8',   // Slate 400
  textDim: '#64748B',     // Slate 500
  border: 'rgba(255, 255, 255, 0.08)',
  divider: 'rgba(255, 255, 255, 0.04)',
  
  // Specific
  gold: '#FBBF24',
  silver: '#E2E8F0',
  glass: 'rgba(255, 255, 255, 0.03)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  
  // Status Colors (Mapping)
  status: {
    safe: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    offline: '#64748B',
  }
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const SHADOWS = Platform.select({
  ios: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
    },
    hard: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
    }
  },
  android: {
    soft: {
      elevation: 6,
    },
    hard: {
      elevation: 12,
    }
  }
});

export const TYPOGRAPHY = {
  h1: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  h3: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400' },
  medium: { fontSize: 14, fontWeight: '500' },
  caption: { fontSize: 12, fontWeight: '400' },
  tiny: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
};

export default {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  TYPOGRAPHY,
  dimensions: { width, height }
};
