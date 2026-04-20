import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Animated, Easing
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import useAnimalStore from '../store/animalStore';
import { subscribeAnimal, unsubscribeAnimal } from '../services/socketService';

const { width } = Dimensions.get('window');

const COLORS = {
  primary:    '#6366F1', 
  background: '#0F172A', 
  surface:    '#1E293B', 
  card:       'rgba(30, 41, 59, 0.7)',
  text:       '#F8FAFC', 
  subtext:    '#94A3B8', 
  safe:       '#10B981', 
  warning:    '#F59E0B', 
  danger:     '#EF4444', 
  offline:    '#64748B', 
  border:     'rgba(255, 255, 255, 0.08)',
};

// Simple Haversine for live distance calculation
function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

export default function AnimalViewScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { animalId } = route.params;
  const { animals, fetchAnimal, fetchAIAnalysis, selectedAnimalAI } = useAnimalStore();
  const animal = animals.find(a => a.id === animalId);
  
  const [loading, setLoading] = useState(!animal);
  const [userLocation, setUserLocation] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const load = async () => {
      await Promise.all([
        fetchAnimal(animalId),
        fetchAIAnalysis(animalId)
      ]);
      setLoading(false);
    };
    load();
    subscribeAnimal(animalId);
    
    // Watch user location for live distance
    let sub;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 5 },
          loc => setUserLocation(loc.coords)
        );
      }
    })();

    // Pulse animation for heart rate
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    return () => {
      unsubscribeAnimal(animalId);
      if (sub) sub.remove();
    };
  }, [animalId]);

  const distance = useMemo(() => {
    if (!userLocation || !animal) return null;
    const d = haversineDist(userLocation.latitude, userLocation.longitude, parseFloat(animal.latitude), parseFloat(animal.longitude));
    return d > 1000 ? `${(d/1000).toFixed(2)} km` : `${Math.round(d)} m`;
  }, [userLocation, animal?.latitude, animal?.longitude]);

  if (loading || !animal) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const statusColor = COLORS[animal.status] || COLORS.offline;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{animal.name}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{animal.status.toUpperCase()}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('AnimalDetail', { animal, mode: 'edit' })}>
          <Ionicons name="options-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Real-time Map Visual */}
        <View style={styles.mapCard}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            mapType="hybrid"
            region={{
              latitude: parseFloat(animal.latitude || 35.038),
              longitude: parseFloat(animal.longitude || 9.484),
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
          >
            <Marker coordinate={{ latitude: parseFloat(animal.latitude), longitude: parseFloat(animal.longitude) }}>
              <View style={[styles.animalMarker, { borderColor: statusColor }]}>
                <MaterialCommunityIcons name="paw" size={18} color={statusColor} />
              </View>
            </Marker>
            {userLocation && (
              <Marker coordinate={userLocation}>
                <View style={styles.userMarker}>
                  <Ionicons name="navigate" size={16} color={COLORS.primary} />
                </View>
              </Marker>
            )}
          </MapView>
          <View style={styles.mapOverlay}>
            <Text style={styles.coordText}>GPS: {parseFloat(animal.latitude).toFixed(5)}, {parseFloat(animal.longitude).toFixed(5)}</Text>
          </View>
        </View>

        {/* Dashboard Grid */}
        <View style={styles.dashboardGrid}>
          {/* Heart Rate */}
          <View style={styles.widget}>
            <View style={styles.widgetHeader}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Ionicons name="heart" size={20} color={COLORS.danger} />
              </Animated.View>
              <Text style={styles.widgetLabel}>Heart Rate</Text>
            </View>
            <Text style={styles.widgetValue}>{animal.heart_rate || '--'} <Text style={styles.unit}>BPM</Text></Text>
            <View style={[styles.widgetStatus, { backgroundColor: COLORS.danger + '22' }]}>
              <Text style={[styles.widgetStatusText, { color: COLORS.danger }]}>Live Sync</Text>
            </View>
          </View>

          {/* Temperature */}
          <View style={styles.widget}>
            <View style={styles.widgetHeader}>
              <Ionicons name="thermometer" size={20} color={COLORS.warning} />
              <Text style={styles.widgetLabel}>Body Temp</Text>
            </View>
            <Text style={styles.widgetValue}>{animal.temperature ? parseFloat(animal.temperature).toFixed(1) : '--'} <Text style={styles.unit}>°C</Text></Text>
            <View style={[styles.widgetStatus, { backgroundColor: COLORS.safe + '22' }]}>
              <Text style={[styles.widgetStatusText, { color: COLORS.safe }]}>Normal</Text>
            </View>
          </View>

          {/* Activity */}
          <View style={styles.widget}>
            <View style={styles.widgetHeader}>
              <Ionicons name="flash" size={20} color={COLORS.primary} />
              <Text style={styles.widgetLabel}>Activity</Text>
            </View>
            <Text style={styles.widgetValue}>{animal.activity || '--'} <Text style={styles.unit}>%</Text></Text>
            <Text style={styles.widgetHint}>Moving state</Text>
          </View>

          {/* User Proximity */}
          <View style={[styles.widget, { backgroundColor: COLORS.primary + '11', borderColor: COLORS.primary + '22' }]}>
            <View style={styles.widgetHeader}>
              <Ionicons name="location" size={20} color={COLORS.primary} />
              <Text style={styles.widgetLabel}>To You</Text>
            </View>
            <Text style={[styles.widgetValue, { color: COLORS.primary }]}>{distance || 'Locating...'}</Text>
            <Text style={styles.widgetHint}>Real-time proximity</Text>
          </View>
        </View>

        {/* AI Health Insights Section */}
        <View style={styles.aiPanel}>
          <View style={styles.aiHeader}>
            <View style={styles.aiTitleRow}>
              <MaterialCommunityIcons name="robot" size={22} color={COLORS.primary} />
              <Text style={styles.aiTitle}>Smart AI Health Insights</Text>
            </View>
            {selectedAnimalAI && (
              <View style={[styles.statusBadge, { 
                backgroundColor: selectedAnimalAI.status === 'CRITICAL' ? COLORS.danger : 
                                 selectedAnimalAI.status === 'ATTENTION' ? COLORS.warning : COLORS.safe 
              }]}>
                <Text style={styles.statusBadgeText}>{selectedAnimalAI.status}</Text>
              </View>
            )}
          </View>

          {selectedAnimalAI ? (
            <View style={styles.aiContent}>
              <View style={styles.riskRow}>
                <View style={styles.riskInfo}>
                  <Text style={styles.riskLabel}>Risk Score</Text>
                  <Text style={[styles.riskValue, { 
                     color: selectedAnimalAI.risk_score > 70 ? COLORS.danger : 
                            selectedAnimalAI.risk_score > 30 ? COLORS.warning : COLORS.safe 
                  }]}>{selectedAnimalAI.risk_score}/100</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { 
                    width: `${selectedAnimalAI.risk_score}%`,
                    backgroundColor: selectedAnimalAI.risk_score > 70 ? COLORS.danger : 
                                     selectedAnimalAI.risk_score > 30 ? COLORS.warning : COLORS.safe 
                  }]} />
                </View>
              </View>

              <View style={styles.aiDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailTitle}>Probable Cause</Text>
                  <Text style={styles.detailText}>{selectedAnimalAI.cause}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailTitle}>Recommendation</Text>
                  <Text style={styles.detailText}>{selectedAnimalAI.recommendation}</Text>
                </View>
              </View>
              
              <Text style={styles.aiConfidence}>AI Confidence: {(selectedAnimalAI.confidence * 100).toFixed(1)}%</Text>
            </View>
          ) : (
            <View style={styles.aiEmpty}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={styles.aiEmptyText}>Analyzing health patterns...</Text>
            </View>
          )}
        </View>

        {/* Device Stats */}
        <View style={styles.statsPanel}>
          <Text style={styles.panelTitle}>Sensor Connectivity</Text>
          <View style={styles.statsGrid}>
            <DeviceStat label="Battery" value={`${animal.battery_level || 100}%`} icon={animal.battery_level > 20 ? "battery" : "battery-alert"} color={animal.battery_level > 20 ? COLORS.safe : COLORS.danger} />
            <DeviceStat label="Signal" value={`${animal.signal_strength || 100}%`} icon="wifi" color={COLORS.primary} />
            <DeviceStat label="Last Update" value={animal.last_seen ? new Date(animal.last_seen).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '--'} icon="clock-outline" color={COLORS.subtext} />
          </View>
        </View>

        {/* Identity Section */}
        <View style={styles.infoPanel}>
          <Text style={styles.panelTitle}>Animal Identification</Text>
          <InfoItem label="Unique ID" value={animal.id} />
          <InfoItem label="Breed" value={animal.breed || 'Not specified'} />
          <InfoItem label="Age" value={animal.age ? `${animal.age} years` : 'Unknown'} />
          <InfoItem label="Weight" value={animal.weight_kg ? `${animal.weight_kg} kg` : '--'} />
          <InfoItem label="Device ID" value={animal.device_id || 'Not linked'} />
        </View>
      </ScrollView>
    </View>
  );
}

function DeviceStat({ label, value, icon, color }) {
  return (
    <View style={styles.devStat}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={styles.devStatValue}>{value}</Text>
      <Text style={styles.devStatLabel}>{label}</Text>
    </View>
  );
}

function InfoItem({ label, value }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: COLORS.surface },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerInfo: { flex: 1, marginLeft: 15 },
  headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  settingsBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },

  scroll: { padding: 20, paddingBottom: 60 },
  mapCard: { height: 200, borderRadius: 28, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  map: { flex: 1 },
  mapOverlay: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  coordText: { color: COLORS.text, fontSize: 10, fontWeight: '700' },
  animalMarker: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  userMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4 },

  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  widget: { width: (width - 52) / 2, backgroundColor: COLORS.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  widgetLabel: { color: COLORS.subtext, fontSize: 12, fontWeight: '700', marginLeft: 8 },
  widgetValue: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  unit: { fontSize: 14, color: COLORS.subtext, fontWeight: '600' },
  widgetStatus: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 10 },
  widgetStatusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  widgetHint: { color: COLORS.subtext, fontSize: 10, marginTop: 8, fontWeight: '600' },

  statsPanel: { backgroundColor: COLORS.surface, borderRadius: 28, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  panelTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 20 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  devStat: { alignItems: 'center', flex: 1 },
  devStatValue: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 8 },
  devStatLabel: { color: COLORS.subtext, fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },

  infoPanel: { backgroundColor: COLORS.surface, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  infoItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  infoValue: { color: COLORS.text, fontSize: 14, fontWeight: '700' },

  // AI Panel Styles
  aiPanel: { backgroundColor: COLORS.surface, borderRadius: 28, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: COLORS.primary + '33', shadowColor: COLORS.primary, shadowOpacity: 0.1, shadowRadius: 15 },
  aiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  aiContent: {},
  riskRow: { marginBottom: 20 },
  riskInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  riskLabel: { color: COLORS.subtext, fontSize: 12, fontWeight: '700' },
  riskValue: { fontSize: 18, fontWeight: '900' },
  progressBarBg: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  aiDetails: { gap: 12, marginBottom: 15 },
  detailItem: { backgroundColor: COLORS.background, padding: 12, borderRadius: 16 },
  detailTitle: { color: COLORS.primary, fontSize: 11, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase' },
  detailText: { color: COLORS.text, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  aiConfidence: { color: COLORS.subtext, fontSize: 10, textAlign: 'right', fontStyle: 'italic' },
  aiEmpty: { padding: 20, alignItems: 'center', gap: 10 },
  aiEmptyText: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
});
