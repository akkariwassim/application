import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../config/theme';

/**
 * Premium HUD for Live Map
 * Features: Follow Toggle, Recenter, Map Type Selector, and Quick Filters
 */
const MapControls = ({
  followUser,
  onToggleFollow,
  onRecenter,
  onRecenterAll,
  mapType,
  onToggleMapType,
  showZones,
  onToggleZones,
  onResetMap,
  selectedAnimal,
  socketConnected = true,
  showHistory,
  onToggleHistory,
  onOpenFilters,
  isLocked,
  onToggleLock
}) => {
  return (
    <View style={styles.container}>
      {/* ── Top Bar Controls (Glassmorphism inspired) ── */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={[styles.btn, (followUser || isLocked || (selectedAnimal && !selectedAnimal.manualMove)) && styles.btnActive]} 
          onPress={onToggleFollow}
          activeOpacity={0.7}
        >
          <View style={[styles.btnIconBg, (followUser || isLocked || selectedAnimal) && styles.btnIconBgActive]}>
            <Ionicons 
              name={selectedAnimal ? "paw" : (isLocked ? "lock-closed" : (followUser ? "navigate" : "navigate-outline"))} 
              size={18} 
              color={(followUser || isLocked || selectedAnimal) ? COLORS.white : COLORS.primary} 
            />
          </View>
          <Text style={[styles.btnText, (followUser || isLocked || selectedAnimal) && styles.btnTextActive]}>
            {selectedAnimal ? `${selectedAnimal.name}` : (isLocked ? 'Verrouillé' : (followUser ? 'Suivi ON' : 'Libre'))}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, { backgroundColor: socketConnected ? COLORS.success : COLORS.danger }]} />
          <Text style={styles.liveText}>{socketConnected ? 'DIRECT' : 'OFFLINE'}</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.btn} onPress={onToggleMapType} activeOpacity={0.7}>
          <View style={styles.btnIconBg}>
            <MaterialCommunityIcons 
              name={mapType === 'hybrid' ? 'layers-outline' : 'earth'} 
              size={18} 
              color={COLORS.primary} 
            />
          </View>
          <Text style={styles.btnText}>{mapType === 'hybrid' ? 'Sat.' : 'Plan'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Floating Action Buttons (Bottom Right) ── */}
      <View style={styles.fabCol}>
        <TouchableOpacity 
          style={[styles.fabSmall, showHistory && styles.fabActive]} 
          onPress={onToggleHistory} 
          activeOpacity={0.8}
        >
          <Ionicons name="trail-sign-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.fabSmall} 
          onPress={onOpenFilters} 
          activeOpacity={0.8}
        >
          <Ionicons name="options-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.fabSmall} 
          onPress={onToggleZones} 
          activeOpacity={0.8}
        >
          <Ionicons name="layers" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.fabMain, followUser && styles.fabMainActive]} 
          onPress={onRecenter}
          onLongPress={onRecenterAll}
          delayLongPress={500}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={28} color={COLORS.white} />
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
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'ios' ? 64 : 44,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...SHADOWS.soft,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 8,
  },
  btnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  btnIconBg: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIconBgActive: {
    backgroundColor: COLORS.primary,
  },
  btnText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  btnTextActive: {
    color: COLORS.white,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  fabCol: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    gap: 12,
    alignItems: 'center',
  },
  fabMain: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.hard,
  },
  fabMainActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.white,
  },
  fabSmall: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(10, 15, 30, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  fabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.white,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

export default React.memo(MapControls);
