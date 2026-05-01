import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useConnectivityStore } from '../services/connectivityService';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../config/theme';

const SyncStatusIndicator = () => {
  const { isConnected, isInternetReachable } = useConnectivityStore();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isSyncing, setIsSyncing] = useState(false); // Can be tied to flushSyncQueue later

  const online = isConnected && isInternetReachable;

  useEffect(() => {
    // Show indicator briefly when connectivity changes, or keep it visible if offline
    if (!online) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      // Hide after 3 seconds when back online
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [online]);

  if (online && fadeAnim._value === 0) return null;

  return (
    <Animated.View style={[
      styles.container, 
      { opacity: fadeAnim, backgroundColor: online ? COLORS.success : COLORS.danger }
    ]}>
      <Ionicons name={online ? 'cloud-done' : 'cloud-offline'} size={14} color={COLORS.white} />
      <Text style={styles.text}>{online ? 'Données synchronisées' : 'Mode Hors-ligne actif'}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.pill,
    zIndex: 9999,
    ...SHADOWS.soft,
  },
  text: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  }
});

export default SyncStatusIndicator;
