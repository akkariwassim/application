import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Modal, FlatList,
  Alert, Platform, LayoutAnimation, Animated
} from 'react-native';
import MapView from 'react-native-map-clustering'; // Clustered Map
import { Marker, Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import useAnimalStore from '../store/animalStore';
import useGeofenceStore from '../store/geofenceStore';
import useAuthStore from '../store/authStore';
import { isPointInPolygon } from '../utils/geoUtils';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import theme, { COLORS, SHADOWS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../config/theme';
import AnimalMarker from '../components/AnimalMarker';
import MapControls from '../components/MapUI/MapControls';

// ── Map State Machine Types ──
const MAP_STATES = {
  INITIALIZING: 'initializing',
  READY:        'ready',
  NO_GPS:       'no_gps',
  DENIED:       'denied',
  ERROR:        'error'
};

/**
 * PRODUCTION OPTIMIZATION: Memoized Animal Marker
 * Prevents heavy re-renders in the Map engine.
 */
const MemoizedAnimalMarker = React.memo(({ animal, onPress }) => {
  return (
    <AnimalMarker 
      animal={animal} 
      onPress={onPress} 
    />
  );
}, (prev, next) => {
  // Only re-render if critical tracking data changed
  return prev.animal.id === next.animal.id &&
         prev.animal.latitude === next.animal.latitude &&
         prev.animal.longitude === next.animal.longitude &&
         prev.animal.status === next.animal.status &&
         prev.animal.last_sync === next.animal.last_sync;
});

const { width } = Dimensions.get('window');

// Use STATUS_COLOR from theme.COLORS.status
const STATUS_COLOR = COLORS.status;

// ── Haversine distance in metres (fast inline) ────────────────────────────────
function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Lightweight Grid-based Clustering
 */
function getClusters(animals, region, clusterRadius = 40) {
  if (!animals.length || !region) return [];
  const latPerPixel = region.latitudeDelta / Dimensions.get('window').height;
  const lonPerPixel = region.longitudeDelta / Dimensions.get('window').width;
  const clusterSizeLat = clusterRadius * latPerPixel;
  const clusterSizeLon = clusterRadius * lonPerPixel;
  const clusters = [];
  const processed = new Set();
  for (let i = 0; i < animals.length; i++) {
    if (processed.has(i)) continue;
    const a = animals[i];
    const group = [a];
    processed.add(i);
    for (let j = i + 1; j < animals.length; j++) {
      if (processed.has(j)) continue;
      const b = animals[j];
      const dLat = Math.abs(parseFloat(a.latitude) - parseFloat(b.latitude));
      const dLon = Math.abs(parseFloat(a.longitude) - parseFloat(b.longitude));
      if (dLat < clusterSizeLat && dLon < clusterSizeLon) {
        group.push(b);
        processed.add(j);
      }
    }
    if (group.length > 1) {
      const avgLat = group.reduce((s, x) => s + parseFloat(x.latitude), 0) / group.length;
      const avgLon = group.reduce((s, x) => s + parseFloat(x.longitude), 0) / group.length;
      clusters.push({ id: `cluster-${i}`, isCluster: true, count: group.length, latitude: avgLat, longitude: avgLon, animals: group });
    } else {
      clusters.push({ ...a, isCluster: false });
    }
  }
  return clusters;
}

function safeParseCoords(coordsData) {
  if (!coordsData) return [];
  try {
    const raw = typeof coordsData === 'string' ? JSON.parse(coordsData) : coordsData;
    if (!Array.isArray(raw)) return [];
    return raw.map(p => {
      if (!p) return null;
      if (typeof p.latitude === 'number' && typeof p.longitude === 'number') return p;
      if (Array.isArray(p) && p.length >= 2) return { latitude: parseFloat(p[1]), longitude: parseFloat(p[0]) };
      return null;
    }).filter(Boolean);
  } catch (err) {
    return [];
  }
}

export default function MapScreen({ route }) {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const mapRef     = useRef(null);

  const { animals, fetchAnimals, isLoading } = useAnimalStore();
  const { geofences, fetchGeofences }        = useGeofenceStore();
  const { user }                             = useAuthStore();

  const [selectedAnimal,  setSelectedAnimal]  = useState(null);
  const [showZonesList,   setShowZonesList]   = useState(false);
  const [userLocation,    setUserLocation]    = useState(null);
  const [markerLoc,       setMarkerLoc]       = useState(null); 
  const [currentRegion,   setCurrentRegion]   = useState(null);
  const [pulseAnim]                     = useState(new Animated.Value(0));
  const [mapState, setMapState] = useState(MAP_STATES.INITIALIZING);
  const [mapType, setMapType]   = useState('hybrid');
  const [followUser, setFollowUser]     = useState(true);
  const [isMapReady, setIsMapReady]     = useState(false);
  const [hasLocation, setHasLocation]   = useState(false);

  const locationSub = useRef(null);
  const mapReadyRef = useRef(false);

  useEffect(() => {
    fetchAnimals();
    fetchGeofences();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    );
    pulse.start();
    return () => { pulse.stop(); cleanupTracking(); };
  }, []);

  const cleanupTracking = () => {
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }
  };

  const visibleAnimals = useMemo(() => {
    const filtered = selectedAnimal?.isZone
      ? animals.filter(a => String(a.current_zone_id || '') === String(selectedAnimal.id || ''))
      : animals;
    return getClusters(filtered, currentRegion, 35); 
  }, [animals, selectedAnimal?.id, selectedAnimal?.isZone, currentRegion]);

  const startTracking = async () => {
    try {
      setMapState(MAP_STATES.INITIALIZING);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMapState(MAP_STATES.DENIED);
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setMapState(MAP_STATES.NO_GPS);
        return;
      }
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (initial) {
        const initLoc = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
        setUserLocation(initLoc);
        setMarkerLoc(initLoc);
        setHasLocation(true);
      }
      setMapState(MAP_STATES.READY);
      cleanupTracking();
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 3 },
        loc => {
          if (!loc.coords || loc.coords.accuracy > 35) return; 
          const newLoc = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, heading: loc.coords.heading };
          setUserLocation(prev => {
            if (!prev) { setMarkerLoc(newLoc); setHasLocation(true); return newLoc; }
            if (getDistance(prev, newLoc) < 2.5) return prev;
            setMarkerLoc(prevM => {
              if (!prevM) return newLoc;
              const alpha = 0.45;
              return { latitude: prevM.latitude + (newLoc.latitude - prevM.latitude) * alpha, longitude: prevM.longitude + (newLoc.longitude - prevM.longitude) * alpha };
            });
            return newLoc;
          });
        }
      );
    } catch (err) { setMapState(MAP_STATES.ERROR); }
  };

  useFocusEffect(useCallback(() => { startTracking(); return () => cleanupTracking(); }, []));

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current || !userLocation) return;
    if (followUser && !selectedAnimal) {
      mapRef.current.animateCamera({ center: { latitude: userLocation.latitude, longitude: userLocation.longitude }, pitch: 45, altitude: 1000, zoom: 17 }, { duration: 1500 });
    }
  }, [userLocation?.latitude, followUser, !!selectedAnimal]);

  const handleMapReady = () => {
    if (!mapReadyRef.current) {
      mapReadyRef.current = true;
      setIsMapReady(true);
      if (userLocation) recenterOnUser(false);
    }
  };

  const recenterOnUser = (manual = true) => {
    if (!userLocation || !mapRef.current) return;
    if (manual) { setFollowUser(true); setSelectedAnimal(null); }
    mapRef.current.animateCamera({ center: { latitude: userLocation.latitude, longitude: userLocation.longitude }, pitch: 45, zoom: 17 }, { duration: 1200 });
  };

  const focusZone = (gf) => {
    setShowZonesList(false);
    const coords = safeParseCoords(gf.polygon_coords);
    if (coords?.length) {
      mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 120, right: 120, bottom: 280, left: 120 }, animated: true });
    }
    const zoneId = String(gf.id || gf._id);
    setSelectedAnimal({ isZone: true, ...gf, id: zoneId, animalsInside: animals.filter(a => String(a.current_zone_id || '') === zoneId).length });
  };

  const mapZones = useMemo(() => {
    return geofences.map(gf => {
      const coords = safeParseCoords(gf.polygon_coords);
      if (coords.length === 0) return null;
      const isSelected = selectedAnimal?.isZone && String(selectedAnimal.id) === String(gf.id || gf._id);
      return (
        <Polygon
          key={`zone-${gf.id || gf._id}`}
          coordinates={coords}
          fillColor={isSelected ? `${COLORS.gold}22` : `${gf.fill_color || COLORS.primary}22`}
          strokeColor={isSelected ? COLORS.gold : (gf.fill_color || COLORS.primary)}
          strokeWidth={isSelected ? 3 : 2}
          onPress={() => focusZone(gf)}
          tappable={true}
        />
      );
    });
  }, [geofences, selectedAnimal?.id]);

  const renderLoading = () => (
    <View style={styles.fullscreenOverlay}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loaderText}>Initialisation SIG...</Text>
    </View>
  );

  if (mapState === MAP_STATES.INITIALIZING) return <View style={styles.container}>{renderLoading()}</View>;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        onRegionChangeComplete={setCurrentRegion}
        onMapReady={handleMapReady}
        initialRegion={{ latitude: 35.038, longitude: 9.484, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      >
        {mapZones}
        {markerLoc && (
          <Marker coordinate={markerLoc} anchor={{ x: 0.5, y: 0.5 }} zIndex={1000} cluster={false}>
            <View style={styles.userDotContainer}>
              <Animated.View style={[styles.userPulse, { transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }], opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }) }]} />
              <View style={styles.userInternal}><Ionicons name="navigate" size={12} color={COLORS.white} /></View>
            </View>
          </Marker>
        )}
        {visibleAnimals.map(item => {
          if (item.isCluster) {
            return (
              <Marker key={item.id} coordinate={{ latitude: item.latitude, longitude: item.longitude }} onPress={() => mapRef.current?.animateToRegion({ latitude: item.latitude, longitude: item.longitude, latitudeDelta: currentRegion.latitudeDelta/4, longitudeDelta: currentRegion.longitudeDelta/4 }, 600)}>
                <View style={styles.clusterMarker}><View style={styles.clusterInner}><Text style={styles.clusterText}>{item.count}</Text></View></View>
              </Marker>
            );
          }
          const color = STATUS_COLOR[item.status] || STATUS_COLOR.offline;
          const isSel = selectedAnimal?.id === item.id;
          return (
            <Marker key={item.id} coordinate={{ latitude: parseFloat(item.latitude), longitude: parseFloat(item.longitude) }} anchor={{ x: 0.5, y: 0.5 }} onPress={() => setSelectedAnimal({ ...item, isZone: false })}>
              <View style={[styles.animalPin, { borderColor: color }, isSel && styles.animalPinSelected]}>
                <MaterialCommunityIcons name={item.type === 'equine' ? 'horse-variant' : item.type === 'bovine' ? 'cow' : 'sheep'} size={17} color={color} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <MapControls 
        followUser={followUser}
        onToggleFollow={() => setFollowUser(!followUser)}
        onRecenter={() => recenterOnUser(true)}
        mapType={mapType}
        onToggleMapType={() => setMapType(prev => prev === 'hybrid' ? 'standard' : 'hybrid')}
        onToggleZones={() => setShowZonesList(true)}
        onResetMap={() => startTracking()}
        selectedAnimal={selectedAnimal}
      />

      {selectedAnimal && (
        <View style={[styles.detailSheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.detailHeader}>
            <View style={[styles.detailIcon, { backgroundColor: selectedAnimal.isZone ? COLORS.primary : (STATUS_COLOR[selectedAnimal.status] || COLORS.status.offline) }]}>
              <Ionicons name={selectedAnimal.isZone ? 'shield-checkmark' : 'paw'} size={22} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{selectedAnimal.name || 'Animal'}</Text>
              <Text style={styles.detailSubtitle}>
                {selectedAnimal.isZone ? `${(selectedAnimal.area_sqm / 10000).toFixed(2)} Ha · ${selectedAnimal.animalsInside} animaux` : `${selectedAnimal.type} · ${selectedAnimal.breed || 'Sans race'}`}
              </Text>
            </View>
            <TouchableOpacity style={styles.detailActionBtn} onPress={() => selectedAnimal.isZone ? navigation.navigate('ZonesList') : navigation.navigate('Animals', { screen: 'AnimalDetail', params: { animal: selectedAnimal } })}>
              <Text style={styles.detailActionText}>Détails</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {!selectedAnimal.isZone && (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}><Ionicons name="thermometer" size={16} color={COLORS.danger} /><Text style={styles.statVal}>{selectedAnimal.temperature || "—"}°C</Text><Text style={styles.statLab}>Temp.</Text></View>
              <View style={styles.statCard}><Ionicons name="heart" size={16} color={COLORS.primary} /><Text style={styles.statVal}>{selectedAnimal.heart_rate || "—"}</Text><Text style={styles.statLab}>BPM</Text></View>
              <View style={styles.statCard}><Ionicons name="battery-dead" size={16} color={COLORS.success} /><Text style={styles.statVal}>{selectedAnimal.battery_level || "—"}%</Text><Text style={styles.statLab}>Batterie</Text></View>
            </View>
          )}
        </View>
      )}

      <Modal visible={showZonesList} transparent animationType="slide" onRequestClose={() => setShowZonesList(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowZonesList(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalTitleRow}>
                <View><Text style={styles.modalTitle}>Zones & Parcelles</Text><Text style={styles.modalSubtitle}>{geofences.length} périmètres configurés</Text></View>
                <TouchableOpacity style={styles.addZoneBtn} onPress={() => { setShowZonesList(false); navigation.navigate('Geofence'); }}><Ionicons name="add" size={20} color={COLORS.white} /><Text style={styles.addZoneBtnText}>Ajouter</Text></TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={geofences}
              keyExtractor={(item) => String(item.id || item._id)}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => {
                const animalCount = animals.filter(a => String(a.current_zone_id || '') === String(item.id || item._id)).length;
                return (
                  <TouchableOpacity style={styles.zoneMiniItem} onPress={() => focusZone(item)}>
                    <View style={[styles.zoneDot, { backgroundColor: item.fill_color || COLORS.primary }]} />
                    <View style={{ flex: 1 }}><Text style={styles.zoneMiniName}>{item.name || 'Zone'}</Text><Text style={styles.zoneMiniSub}>{animalCount} animaux · {(item.area_sqm / 10000).toFixed(1)} Ha</Text></View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  fullscreenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  loaderText: { color: COLORS.white, fontSize: 18, fontWeight: '800', marginTop: 20 },
  userDotContainer: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  userPulse: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: `${COLORS.primary}66` },
  userInternal: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.white, alignItems: 'center', justifyContent: 'center', ...SHADOWS.soft },
  clusterMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(99, 102, 241, 0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.6)' },
  clusterInner: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOWS.soft },
  clusterText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  animalPin: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center', ...SHADOWS.soft },
  animalPinSelected: { transform: [{ scale: 1.2 }], borderColor: COLORS.gold, zIndex: 100 },
  detailSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.hard },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  detailIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  detailSubtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  detailActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${COLORS.primary}15`, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  detailActionText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: SPACING.md },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statVal: { color: COLORS.white, fontSize: 16, fontWeight: '800', marginTop: 8 },
  statLab: { color: COLORS.textDim, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '70%', paddingTop: 12 },
  modalHeader: { paddingHorizontal: 24, paddingBottom: 16 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  modalTitle: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  modalSubtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  addZoneBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, gap: 4 },
  addZoneBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  modalList: { padding: 20 },
  zoneMiniItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  zoneDot: { width: 10, height: 10, borderRadius: 5, marginRight: 16 },
  zoneMiniName: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  zoneMiniSub: { color: COLORS.textDim, fontSize: 11, marginTop: 2 },
});
