'use strict';

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
  Dimensions, Platform, StatusBar
} from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { getDistance } from 'geolib';
import api from '../services/api';
import theme, { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../config/theme';

const { width } = Dimensions.get('window');

function StatCard({ icon, label, value, color }) {
  return (
    <View style={[styles.statCard, { borderBottomColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen({ route, navigation }) {
  const { animal } = route.params;
  const [positions, setPositions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState('today');

  const periodOptions = [
    { key:'today',  label:'Aujourd\'hui', hours: 24  },
    { key:'week',   label:'7 Jours',      hours: 168 },
    { key:'month',  label:'30 Jours',     hours: 720 },
  ];

  useEffect(() => {
    fetchHistory();
  }, [period]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const hours = periodOptions.find(p => p.key === period)?.hours || 24;
      const from  = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      // Fetch from positions history endpoint
      const { data } = await api.get(`/positions/${animal.id}?from=${from}&limit=500`);
      setPositions(data);
    } catch (err) {
      console.error('[History] Fetch error:', err);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Compute stats ───────────────────────────────────────────
  const validPositions = positions.filter(p => p.latitude && p.longitude);

  const totalDistanceM = validPositions.reduce((acc, pos, i) => {
    if (i === 0) return 0;
    const prev = validPositions[i - 1];
    return acc + getDistance(
      { latitude: prev.latitude, longitude: prev.longitude },
      { latitude: pos.latitude, longitude: pos.longitude }
    );
  }, 0);

  const polylineCoords = validPositions.map(p => ({
    latitude: parseFloat(p.latitude),
    longitude: parseFloat(p.longitude),
  }));

  const latestPos = polylineCoords[0];
  const oldestPos = polylineCoords[polylineCoords.length - 1];

  const initialRegion = latestPos
    ? { 
        latitude: latestPos.latitude, 
        longitude: latestPos.longitude, 
        latitudeDelta: 0.015, 
        longitudeDelta: 0.015 
      }
    : { latitude: 35.038, longitude: 9.484, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Historique</Text>
          <Text style={styles.subtitle}>{animal.name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Period Selector */}
        <View style={styles.periodContainer}>
          {periodOptions.map(p => (
            <TouchableOpacity 
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodBtnText, period === p.key && styles.periodBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={styles.loaderText}>Chargement du parcours...</Text>
          </View>
        ) : (
          <>
            {/* Stats Row */}
            <View style={styles.statsRow}>
              <StatCard 
                icon="footsteps" 
                label="Distance" 
                value={`${(totalDistanceM / 1000).toFixed(2)} km`} 
                color={COLORS.primary} 
              />
              <StatCard 
                icon="location" 
                label="Positions" 
                value={String(validPositions.length)} 
                color={COLORS.success} 
              />
            </View>

            {/* Trajectory Map */}
            {polylineCoords.length > 0 ? (
              <View style={styles.mapWrapper}>
                <MapView 
                  style={styles.map} 
                  provider={PROVIDER_GOOGLE}
                  initialRegion={initialRegion} 
                  mapType="hybrid"
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Polyline 
                    coordinates={polylineCoords} 
                    strokeColor={COLORS.primary}
                    strokeWidth={4} 
                  />
                  {oldestPos && (
                    <Marker coordinate={oldestPos} anchor={{ x: 0.5, y: 0.5 }}>
                      <View style={[styles.dotMarker, { backgroundColor: COLORS.success }]} />
                    </Marker>
                  )}
                  {latestPos && (
                    <Marker coordinate={latestPos} anchor={{ x: 0.5, y: 0.5 }}>
                      <View style={[styles.dotMarker, { backgroundColor: COLORS.danger, borderWidth: 2, borderColor: COLORS.white }]} />
                    </Marker>
                  )}
                </MapView>
                <TouchableOpacity 
                  style={styles.mapOverlayBtn}
                  onPress={() => navigation.navigate('Map', { focusAnimal: animal })}
                >
                  <Text style={styles.mapOverlayText}>Voir sur la carte interactive</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyMap}>
                <Ionicons name="map-outline" size={48} color={COLORS.textDim} />
                <Text style={styles.emptyText}>Aucune donnée de parcours</Text>
              </View>
            )}

            {/* List Header */}
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Journal de bord</Text>
              <Text style={styles.listSubtitle}>Dernières 50 positions</Text>
            </View>

            {/* Logs */}
            {validPositions.slice(0, 50).map((pos, i) => (
              <View key={pos.id || i} style={styles.logRow}>
                <View style={styles.logTimeCol}>
                  <Text style={styles.logTime}>{new Date(pos.timestamp || pos.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  <Text style={styles.logDate}>{new Date(pos.timestamp || pos.recorded_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}</Text>
                </View>
                <View style={styles.logIndicator}>
                  <View style={styles.logDot} />
                  {i < Math.min(validPositions.length, 50) - 1 && <View style={styles.logLine} />}
                </View>
                <View style={styles.logBody}>
                  <Text style={styles.logCoords}>
                    {parseFloat(pos.latitude).toFixed(5)}, {parseFloat(pos.longitude).toFixed(5)}
                  </Text>
                  <View style={styles.logTags}>
                    <View style={styles.logTag}>
                      <Ionicons name="thermometer" size={10} color={COLORS.danger} />
                      <Text style={styles.logTagText}>{pos.temperature?.toFixed(1) || '38.5'}°C</Text>
                    </View>
                    <View style={styles.logTag}>
                      <Ionicons name="battery-charging" size={10} color={COLORS.success} />
                      <Text style={styles.logTagText}>{pos.battery_level || '--'}%</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:COLORS.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: SPACING.lg, 
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: SPACING.md
  },
  headerText: { flex: 1 },
  title: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  subtitle: { color: COLORS.textMuted, fontSize: 13 },
  
  scroll: { paddingBottom: 60 },
  
  periodContainer: { 
    flexDirection: 'row', 
    padding: SPACING.lg, 
    gap: SPACING.sm 
  },
  periodBtn: { 
    flex: 1, 
    height: 40, 
    borderRadius: 10, 
    backgroundColor: COLORS.surface, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  periodBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodBtnText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  periodBtnTextActive: { color: COLORS.white },

  statsRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, gap: SPACING.md, marginBottom: SPACING.xl },
  statCard: { 
    flex: 1, 
    backgroundColor: COLORS.card, 
    borderRadius: BORDER_RADIUS.lg, 
    padding: SPACING.md, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.md,
    borderBottomWidth: 3,
    ...SHADOWS.soft
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: COLORS.textDim, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { color: COLORS.white, fontSize: 16, fontWeight: '800', marginTop: 2 },

  mapWrapper: { marginHorizontal: SPACING.lg, borderRadius: 24, overflow: 'hidden', height: 200, ...SHADOWS.hard },
  map: { flex: 1 },
  mapOverlayBtn: { 
    position: 'absolute', bottom: 12, right: 12, 
    backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, 
    borderRadius: 8, ...SHADOWS.soft 
  },
  mapOverlayText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  dotMarker: { width: 12, height: 12, borderRadius: 6 },

  emptyMap: { 
    height: 200, marginHorizontal: SPACING.lg, borderRadius: 24, 
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', 
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border 
  },
  emptyText: { color: COLORS.textDim, fontSize: 14, marginTop: 12 },

  listHeader: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl, marginBottom: SPACING.md },
  listTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  listSubtitle: { color: COLORS.textDim, fontSize: 12 },

  logRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, marginBottom: 0 },
  logTimeCol: { width: 60, alignItems: 'flex-end', paddingTop: 2 },
  logTime: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  logDate: { color: COLORS.textDim, fontSize: 10, marginTop: 2 },
  logIndicator: { width: 40, alignItems: 'center' },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6, zIndex: 2 },
  logLine: { width: 2, flex: 1, backgroundColor: COLORS.divider, marginVertical: 4 },
  logBody: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  logCoords: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  logTags: { flexDirection: 'row', gap: 10, marginTop: 8 },
  logTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  logTagText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },

  loader: { padding: 40, alignItems: 'center' },
  loaderText: { color: COLORS.textMuted, fontSize: 14, marginTop: 16 },
});
