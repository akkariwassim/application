import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../config/theme';

/**
 * Professional HUD for Live Map
 * Features: Follow Toggle, Recenter, Map Type Selector, and Quick Filters
 */
const MapControls = ({
  followUser,
  onToggleFollow,
  onRecenter,
  mapType,
  onToggleMapType,
  showZones,
  onToggleZones,
  onResetMap,
  selectedAnimal,
  socketConnected = true
}) => {
  return (
    <View style={styles.container}>
      {/* ── Top Bar Controls ── */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={[styles.btn, (followUser || (selectedAnimal && !selectedAnimal.manualMove)) && styles.btnActive]} 
          onPress={onToggleFollow}
        >
          <Ionicons 
            name={selectedAnimal ? "paw" : (followUser ? "navigate" : "navigate-outline")} 
            size={20} 
            color={(followUser || selectedAnimal) ? COLORS.white : COLORS.primary} 
          />
          <Text style={[styles.btnText, (followUser || selectedAnimal) && styles.btnTextActive]}>
            {selectedAnimal ? `Suivi : ${selectedAnimal.name}` : (followUser ? 'Moi' : 'OFF')}
          </Text>
        </TouchableOpacity>

        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, { backgroundColor: socketConnected ? COLORS.success : COLORS.danger }]} />
          <Text style={styles.liveText}>{socketConnected ? 'LIVE' : 'DISCONNECT'}</Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={onToggleMapType}>
          <MaterialCommunityIcons 
            name={mapType === 'hybrid' ? 'map' : 'earth'} 
            size={20} 
            color={COLORS.primary} 
          />
          <Text style={styles.btnText}>{mapType === 'hybrid' ? 'Sat' : 'Map'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Floating Action Buttons (Bottom Right) ── */}
      <View style={styles.fabCol}>
        <TouchableOpacity style={styles.fabSmall} onPress={onResetMap}>
          <Ionicons name="refresh" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.fabMain, followUser && { backgroundColor: COLORS.success }]} 
          onPress={onRecenter}
        >
          <Ionicons name="locate" size={32} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.md,
    pointerEvents: 'box-none', // Allow touches to pass through to map
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    borderRadius: BORDER_RADIUS.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...SHADOWS.soft,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'transparent',
  },
  btnActive: {
    backgroundColor: COLORS.primary,
  },
  btnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  btnTextActive: {
    color: COLORS.white,
  },
  fabCol: {
    position: 'absolute',
    bottom: 120, // Leave room for detail sheet
    right: SPACING.lg,
    gap: 16,
    alignItems: 'center',
  },
  fabMain: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.hard,
  },
  fabSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 15, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    height: 28,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

export default MapControls;
