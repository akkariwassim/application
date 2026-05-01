import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * Premium 2026 Design System - Smart Fence Pro
 * Colors: Deep Ocean Dark Mode, Neon Accents, Glassmorphism tokens
 */
export const LIGHT_COLORS = {
  primary: '#2ECC71',     // Smart Green
  primaryLight: '#58D68D',
  secondary: '#3498DB',   // Blue
  background: '#F5F7FA',  // Light Gray
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardLight: '#F8FAFC',
  success: '#2ECC71',
  warning: '#F1C40F',
  danger: '#E74C3C',      // Alert Red
  info: '#3498DB',
  white: '#FFFFFF',
  text: '#2C3E50',
  textMuted: '#7F8C8D',
  textDim: '#BDC3C7',
  border: 'rgba(0, 0, 0, 0.05)',
  divider: 'rgba(0, 0, 0, 0.03)',
  gold: '#F1C40F',
  silver: '#BDC3C7',
  glass: 'rgba(255, 255, 255, 0.8)',
  overlay: 'rgba(0, 0, 0, 0.3)',
  status: {
    safe: '#2ECC71',
    warning: '#F1C40F',
    danger: '#E74C3C',
    offline: '#95A5A6',
  }
};

export const DARK_COLORS = {
  primary: '#2ECC71',     
  primaryLight: '#58D68D',
  secondary: '#3498DB',
  background: '#121212',  
  surface: '#1E1E1E',     // Requested Dark Background
  card: '#252525',        
  cardLight: '#2D2D2D',
  success: '#2ECC71',
  warning: '#F1C40F',
  danger: '#E74C3C',
  info: '#3498DB',
  white: '#FFFFFF',
  text: '#ECF0F1',        
  textMuted: '#95A5A6',   
  textDim: '#7F8C8D',     
  border: 'rgba(255, 255, 255, 0.08)',
  divider: 'rgba(255, 255, 255, 0.04)',
  gold: '#F1C40F',
  silver: '#BDC3C7',
  glass: 'rgba(255, 255, 255, 0.03)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  status: {
    safe: '#2ECC71',
    warning: '#F1C40F',
    danger: '#E74C3C',
    offline: '#95A5A6',
  }
};

export const COLORS = DARK_COLORS; // Default for now

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
