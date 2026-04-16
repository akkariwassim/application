import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Modal, FlatList,
  Alert, Platform
} from 'react-native';
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import useAnimalStore from '../store/animalStore';
import useGeofenceStore from '../store/geofenceStore';
import useAuthStore from '../store/authStore';
import { isPointInPolygon } from '../utils/geoUtils';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// ── Design Tokens ─────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  safe:    '#22C55E',
  warning: '#F59E0B',
  danger:  '#EF4444',
  offline: '#64748B',
};

const COLORS = {
  primary:    '#6366F1',
  primaryDim: 'rgba(99,102,241,0.18)',
  background: '#0A0F1E',
  surface:    '#131929',
  card:       '#1A2540',
  text:       '#F1F5F9',
  subtext:    '#94A3B8',
  muted:      '#334155',
  danger:     '#EF4444',
  success:    '#22C55E',
  warn:       '#F59E0B',
  border:     'rgba(255,255,255,0.07)',
  gold:       '#FBBF24',
};

// ── Haversine distance in metres (fast inline) ────────────────────────────────
function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Offset a point by (dLatM, dLonM) metres ──────────────────────────────────
function offsetCoord(lat, lon, dLatM, dLonM) {
  return {
    latitude:  lat + dLatM / 111320,
    longitude: lon + dLonM / (111320 * Math.cos(lat * Math.PI / 180)),
  };
}

/**
 * Conservative Deterministic Circular Spread
 *
 * Rules:
 *  - Only animals DIRECTLY within collisionRadiusM of each other (or zone center) are grouped.
 *  - NO transitive union-find chaining — prevents cascade that pushed markers 60m away.
 *  - Zone center pin is treated as an immovable occupied anchor.
 *  - Visual offset is capped at collisionRadiusM × 1.5 (never large).
 *  - Deterministic: index in the group → fixed angle, same result every render.
 *
 * @param {array}  animals          - raw animals from store
 * @param {number} collisionRadiusM - overlap threshold in metres
 * @param {array}  reservedSlots    - [{lat,lon}] positions that are already occupied (e.g. zone pins)
 */
function spreadMarkers(animals, collisionRadiusM = 10, reservedSlots = []) {
  if (!animals.length) return [];

  // Clone with visual coords starting at real GPS
  const out = animals.map(m => ({
    ...m,
    _vLat:  parseFloat(m.latitude),
    _vLon:  parseFloat(m.longitude),
    _moved: false,
  }));

  const MAX_SPREAD = collisionRadiusM * 1.5; // visual offset cap
  const assigned   = new Array(out.length).fill(false);

  for (let i = 0; i < out.length; i++) {
    if (assigned[i]) continue;

    // ── Check if this animal overlaps a reserved slot (zone center pin) ────
    const overlapsReserved = reservedSlots.some(s =>
      haversineDist(parseFloat(animals[i].latitude), parseFloat(animals[i].longitude), s.lat, s.lon) < collisionRadiusM
    );

    // ── Find direct neighbours (NOT transitive) ────────────────────────────
    const group = [i];
    assigned[i] = true;
    for (let j = i + 1; j < out.length; j++) {
      if (!assigned[j] &&
          haversineDist(
            parseFloat(animals[i].latitude), parseFloat(animals[i].longitude),
            parseFloat(animals[j].latitude), parseFloat(animals[j].longitude)
          ) < collisionRadiusM
      ) {
        group.push(j);
        assigned[j] = true;
      }
    }

    // ── Skip if no conflicts ───────────────────────────────────────────────
    if (group.length === 1 && !overlapsReserved) continue;

    // ── Compute centroid of the group’s TRUE positions ────────────────────
    const cLat = group.reduce((s, k) => s + parseFloat(animals[k].latitude), 0) / group.length;
    const cLon = group.reduce((s, k) => s + parseFloat(animals[k].longitude), 0) / group.length;

    // ── Spread in a circle starting from North, equal angular spacing ─────
    const n       = group.length + (overlapsReserved ? 1 : 0); // +1 slot for the reserved pin
    const offset  = overlapsReserved ? 1 : 0;                   // skip slot 0 (reserved for zone pin)
    group.forEach((animalIdx, pos) => {
      const slotAngle = (2 * Math.PI * (pos + offset)) / n - Math.PI / 2; // northward start
      const { latitude, longitude } = offsetCoord(cLat, cLon,
        MAX_SPREAD * Math.cos(slotAngle),
        MAX_SPREAD * Math.sin(slotAngle)
      );
      out[animalIdx]._vLat  = latitude;
      out[animalIdx]._vLon  = longitude;
      out[animalIdx]._moved = true;
    });
  }

  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function MapScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const mapRef     = useRef(null);

  const { animals, fetchAnimals, isLoading } = useAnimalStore();
  const { geofences, fetchGeofences }        = useGeofenceStore();
  const { user }                             = useAuthStore();

  const [selectedAnimal,  setSelectedAnimal]  = useState(null);
  const [showZonesList,   setShowZonesList]   = useState(false);
  const [userLocation,    setUserLocation]    = useState(null);
  const [currentRegion,   setCurrentRegion]   = useState(null);

  const locationSub = useRef(null);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAnimals();
    fetchGeofences();
    startTracking();
    return () => { locationSub.current?.remove(); };
  }, []);

  // ── Focus: fit all zones, no filter activated ────────────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchAnimals();
      fetchGeofences();
      const t = setTimeout(() => fitAllZones(false), 900);
      return () => clearTimeout(t);
    }, [geofences.length])
  );

  // ── Zoom-proportional collision radius (conservative and capped) ─────────
  // At farm zoom (latDelta ~0.002-0.005): 5-8m  |  Zoomed out (0.01+): 10m max
  const spreadRadiusM = useMemo(() => {
    if (!currentRegion) return 8;
    return Math.min(12, Math.max(4, currentRegion.latitudeDelta * 1800));
  }, [currentRegion?.latitudeDelta]);

  // ── Reserved slots: zone center pins that animals must not overlap ────────
  const reservedSlots = useMemo(() =>
    geofences
      .filter(gf => gf.center_lat && gf.center_lon)
      .map(gf => ({ lat: parseFloat(gf.center_lat), lon: parseFloat(gf.center_lon) })),
  [geofences]);

  // ── Compute spread markers (memoised for perf) ───────────────────────────
  const visibleAnimals = useMemo(() => {
    const filtered = selectedAnimal?.isZone
      ? animals.filter(a => String(a.current_zone_id || '') === String(selectedAnimal.id || ''))
      : animals;
    return spreadMarkers(filtered, spreadRadiusM, reservedSlots);
  }, [animals, selectedAnimal?.id, selectedAnimal?.isZone, spreadRadiusM, reservedSlots]);

  // ── GPS tracking ────────────────────────────────────────────────────────
  const startTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 6000, distanceInterval: 8 },
        loc => setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      );
    } catch (e) {
      console.warn('[MapScreen] tracking error:', e.message);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const centerOnUser = async () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 900);
    } else {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(c);
        mapRef.current?.animateToRegion({ ...c, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 900);
      } catch {
        Alert.alert('GPS', 'Impossible de récupérer votre position.');
      }
    }
  };

  const fitAllZones = (openList = true) => {
    const allCoords = geofences.flatMap(gf => {
      if (gf.type === 'polygon' && gf.polygon_coords) {
        return typeof gf.polygon_coords === 'string'
          ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
      }
      return [];
    });
    if (allCoords.length > 0) {
      mapRef.current?.fitToCoordinates(allCoords, {
        edgePadding: { top: 70, right: 50, bottom: 160, left: 50 },
        animated: true,
      });
    } else {
      centerOnUser();
    }
    if (openList) setShowZonesList(true);
  };

  const focusZone = (gf) => {
    setShowZonesList(false);
    fetchAnimals();
    if (gf.type === 'polygon' && gf.polygon_coords) {
      const coords = typeof gf.polygon_coords === 'string'
        ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
      if (coords?.length) {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 110, right: 110, bottom: 260, left: 110 },
          animated: true,
        });
      }
    } else if (gf.center_lat) {
      mapRef.current?.animateToRegion({
        latitude: parseFloat(gf.center_lat), longitude: parseFloat(gf.center_lon),
        latitudeDelta: 0.005, longitudeDelta: 0.005,
      }, 900);
    }
    const zoneId = String(gf.id || gf._id);
    const animalsInside = animals.filter(a => String(a.current_zone_id || '') === zoneId).length;
    setTimeout(() =>
      setSelectedAnimal({ isZone: true, ...gf, id: zoneId, animalsInside, area: gf.area_sqm }), 60);
  };

  const calculateDistances = (animal) => {
    if (!userLocation || !animal) return {};
    const aC = { latitude: parseFloat(animal.latitude), longitude: parseFloat(animal.longitude) };
    return {
      userAnimal: getDistance(userLocation, aC),
      farmAnimal: (user?.farm_latitude)
        ? getDistance({ latitude: user.farm_latitude, longitude: user.farm_longitude }, aC)
        : null,
    };
  };

  const handleMapLongPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    let zoneId = '';
    for (const gf of geofences) {
      if (gf.type === 'polygon' && gf.polygon_coords) {
        const c = typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
        if (isPointInPolygon({ latitude, longitude }, c)) { zoneId = gf.id || gf._id; break; }
      }
    }
    Alert.alert('Ajouter un animal', 'Placer un animal ici ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Ajouter', onPress: () => navigation.navigate('Animals', {
        screen: 'AnimalDetail',
        params: { mode: 'create', initialLocation: { latitude, longitude }, initialZoneId: zoneId },
      })},
    ]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        mapType="hybrid"
        onLongPress={handleMapLongPress}
        onRegionChangeComplete={setCurrentRegion}
        initialRegion={{ latitude: 35.038, longitude: 9.484, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      >
        {/* ── Zone Polygons ── */}
        {geofences.map(gf => {
          if (gf.type !== 'polygon' || !gf.polygon_coords) return null;
          const coords = typeof gf.polygon_coords === 'string'
            ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
          const gfId      = String(gf.id || gf._id);
          const isSelected = selectedAnimal?.isZone && String(selectedAnimal.id) === gfId;
          const baseColor  = gf.fill_color || COLORS.primary;

          return (
            <React.Fragment key={`zone-${gfId}`}>
              {isSelected && (
                <Polygon
                  coordinates={coords}
                  fillColor="rgba(251,191,36,0.12)"
                  strokeColor="#FB923C"
                  strokeWidth={11}
                  tappable={false}
                />
              )}
              <Polygon
                coordinates={coords}
                fillColor={isSelected ? 'rgba(251,191,36,0.08)' : `${baseColor}22`}
                strokeColor={isSelected ? COLORS.gold : baseColor}
                strokeWidth={isSelected ? 3.5 : 1.8}
                tappable={true}
                onPress={() => focusZone(gf)}
              />
            </React.Fragment>
          );
        })}

        {/* ── Zone Center Pins ── */}
        {geofences.map(gf => {
          if (!gf.center_lat || !gf.center_lon) return null;
          const gfId      = String(gf.id || gf._id);
          const isSelected = selectedAnimal?.isZone && String(selectedAnimal.id) === gfId;
          const isPrimary  = gf.is_primary === true || gf.is_primary === 1;

          return (
            <Marker
              key={`zpin-${gfId}-${isSelected ? 's' : 'n'}`}
              coordinate={{ latitude: parseFloat(gf.center_lat), longitude: parseFloat(gf.center_lon) }}
              onPress={() => focusZone(gf)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={Platform.OS === 'android'}
              zIndex={isSelected ? 20 : 5}
            >
              <View style={styles.zonePinWrapper}>
                <View style={[
                  styles.zonePinCircle,
                  isPrimary  && styles.zonePinPrimary,
                  isSelected && styles.zonePinSelected,
                ]}>
                  <Ionicons
                    name={isSelected ? 'shield-checkmark' : isPrimary ? 'home' : 'location'}
                    size={18}
                    color={isSelected ? '#000' : isPrimary ? COLORS.success : '#fff'}
                  />
                </View>
                <View style={[
                  styles.zonePinLabel,
                  isPrimary  && { borderColor: COLORS.success },
                  isSelected && { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
                ]}>
                  <Text style={[styles.zonePinLabelText, isSelected && { color: '#000' }]} numberOfLines={1}>
                    {isPrimary ? '🏠 ' : ''}{gf.name} · {(gf.area_sqm / 10000).toFixed(2)} Ha
                  </Text>
                </View>
              </View>
            </Marker>
          );
        })}

        {/* ── User Location ── */}
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={200} tracksViewChanges={false}>
            <View style={styles.userOuter}>
              <View style={styles.userPulse} />
              <View style={styles.userDot}>
                <Ionicons name="navigate" size={13} color="#fff" />
              </View>
            </View>
          </Marker>
        )}

        {/* ── Animal Markers (spread) ── */}
        {visibleAnimals.map(animal => {
          const isSelAnimal = !selectedAnimal?.isZone && selectedAnimal?.id === animal.id;
          const color = STATUS_COLOR[animal.status] || STATUS_COLOR.offline;
          const typeIcon = animal.type === 'equine' ? 'horse-variant'
            : animal.type === 'bovine' ? 'cow'
            : animal.type === 'ovine' ? 'sheep' : 'paw';

          return (
            <Marker
              key={`anim-${animal.id}`}
              coordinate={{ latitude: animal._vLat, longitude: animal._vLon }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              zIndex={isSelAnimal ? 50 : 10}
              onPress={() => setSelectedAnimal({ ...animal, isZone: false })}
            >
              <View style={[
                styles.animalPin,
                { borderColor: color },
                isSelAnimal && styles.animalPinSelected,
              ]}>
                {/* Spread indicator dot */}
                {animal._spread && (
                  <View style={[styles.spreadDot, { backgroundColor: color }]} />
                )}
                <MaterialCommunityIcons name={typeIcon} size={17} color={color} />
                {/* Selected glow ring */}
                {isSelAnimal && <View style={[styles.animalGlow, { borderColor: color }]} />}
              </View>
            </Marker>
          );
        })}

        {/* ── Polylines when animal selected ── */}
        {selectedAnimal && !selectedAnimal.isZone && userLocation && (
          <Polyline
            coordinates={[
              userLocation,
              { latitude: parseFloat(selectedAnimal.latitude), longitude: parseFloat(selectedAnimal.longitude) },
            ]}
            strokeColor={COLORS.primary}
            strokeWidth={2}
            lineDashPattern={[6, 4]}
          />
        )}
        {selectedAnimal && !selectedAnimal.isZone && user?.farm_latitude && (
          <Polyline
            coordinates={[
              { latitude: user.farm_latitude, longitude: user.farm_longitude },
              { latitude: parseFloat(selectedAnimal.latitude), longitude: parseFloat(selectedAnimal.longitude) },
            ]}
            strokeColor={COLORS.success}
            strokeWidth={1.5}
            lineDashPattern={[3, 5]}
          />
        )}
      </MapView>

      {/* ── Top Controls ── */}
      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={centerOnUser} activeOpacity={0.8}>
          <Ionicons name="navigate-circle" size={19} color={COLORS.primary} />
          <Text style={styles.topBtnText}>Position</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBtn} onPress={() => fitAllZones(true)} activeOpacity={0.8}>
          <Ionicons name="layers-outline" size={19} color={COLORS.primary} />
          <Text style={styles.topBtnText}>Mes Zones</Text>
        </TouchableOpacity>
        {selectedAnimal?.isZone && (
          <TouchableOpacity style={[styles.topBtn, styles.topBtnClear]} onPress={() => setSelectedAnimal(null)} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={19} color={COLORS.gold} />
            <Text style={[styles.topBtnText, { color: COLORS.gold }]}>Tout afficher</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Zone List Sheet ── */}
      <Modal visible={showZonesList} transparent animationType="slide" onRequestClose={() => setShowZonesList(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowZonesList(false)} />
          <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Mes Zones</Text>
              <TouchableOpacity onPress={() => setShowZonesList(false)}>
                <Ionicons name="close" size={22} color={COLORS.subtext} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={geofences}
              keyExtractor={item => String(item.id || item._id)}
              contentContainerStyle={{ gap: 10 }}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune zone créée</Text>}
              renderItem={({ item }) => {
                const zId = String(item.id || item._id);
                const count = animals.filter(a => String(a.current_zone_id || '') === zId).length;
                const isPri = item.is_primary === true || item.is_primary === 1;
                return (
                  <TouchableOpacity style={styles.zoneCard} onPress={() => focusZone(item)} activeOpacity={0.75}>
                    <View style={[styles.zoneCardBar, { backgroundColor: item.fill_color || COLORS.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.zoneCardName}>{isPri ? '🏠 ' : ''}{item.name || `Zone #${zId}`}</Text>
                      <Text style={styles.zoneCardMeta}>
                        {(item.area_sqm / 10000).toFixed(2)} Ha  ·  {count} animal{count !== 1 ? 'x' : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Detail Sheet ── */}
      {selectedAnimal && (
        <View style={[styles.detailSheet, { paddingBottom: insets.bottom + 12 }]}>
          {/* Close */}
          <TouchableOpacity style={styles.detailClose} onPress={() => setSelectedAnimal(null)}>
            <Ionicons name="close" size={18} color={COLORS.subtext} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.detailHeader}>
            <View style={[styles.detailDot, {
              backgroundColor: selectedAnimal.isZone
                ? (selectedAnimal.fill_color || COLORS.primary)
                : (STATUS_COLOR[selectedAnimal.status] || STATUS_COLOR.offline)
            }]} />
            <Text style={styles.detailName} numberOfLines={1}>
              {selectedAnimal.name || (selectedAnimal.isZone ? `Zone #${selectedAnimal.id}` : 'Animal')}
            </Text>
            <View style={[styles.statusChip, {
              backgroundColor: selectedAnimal.isZone ? COLORS.primaryDim : `${STATUS_COLOR[selectedAnimal.status] || STATUS_COLOR.offline}22`
            }]}>
              <Text style={[styles.statusChipText, {
                color: selectedAnimal.isZone ? COLORS.primary : (STATUS_COLOR[selectedAnimal.status] || STATUS_COLOR.offline)
              }]}>
                {selectedAnimal.isZone ? 'ZONE' : (selectedAnimal.status || '—').toUpperCase()}
              </Text>
            </View>
          </View>

          {selectedAnimal.isZone ? (
            <>
              <Text style={styles.detailMeta}>📐 {(selectedAnimal.area / 10000).toFixed(2)} Ha  ({parseFloat(selectedAnimal.area).toFixed(0)} m²)</Text>
              <Text style={styles.detailMeta}>🐄 {selectedAnimal.animalsInside} animaux présents</Text>
              {selectedAnimal.priority_level && (
                <Text style={[styles.detailMeta, { color: COLORS.primary, marginTop: 6 }]}>
                  Priorité : {selectedAnimal.priority_level}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.detailMeta}>{selectedAnimal.type}  ·  {selectedAnimal.breed || 'Race N/A'}</Text>
              <Text style={styles.detailCoord}>
                📍 {parseFloat(selectedAnimal.latitude).toFixed(6)},  {parseFloat(selectedAnimal.longitude).toFixed(6)}
              </Text>
              {selectedAnimal.speed_mps != null && (
                <Text style={styles.detailMeta}>🏃 {(parseFloat(selectedAnimal.speed_mps) * 3.6).toFixed(1)} km/h</Text>
              )}
              <View style={styles.distRow}>
                {(() => { const d = calculateDistances(selectedAnimal); return (
                  <>
                    {d.userAnimal != null && (
                      <View style={styles.distBadge}>
                        <Ionicons name="person" size={11} color={COLORS.primary} />
                        <Text style={styles.distText}>{(d.userAnimal / 1000).toFixed(2)} km</Text>
                      </View>
                    )}
                    {d.farmAnimal != null && (
                      <View style={styles.distBadge}>
                        <Ionicons name="home" size={11} color={COLORS.success} />
                        <Text style={styles.distText}>{(d.farmAnimal / 1000).toFixed(2)} km</Text>
                      </View>
                    )}
                  </>
                );})()}
              </View>
            </>
          )}
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Top bar
  topBar: {
    position: 'absolute', left: 14, right: 14,
    flexDirection: 'row', gap: 8,
  },
  topBtn: {
    flex: 1, height: 44,
    backgroundColor: 'rgba(13,20,40,0.93)',
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  topBtnClear: { borderColor: `${COLORS.gold}55` },
  topBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },

  // Zone pin
  zonePinWrapper: { width: 130, height: 64, alignItems: 'center', justifyContent: 'center' },
  zonePinCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  zonePinPrimary:  { backgroundColor: COLORS.success },
  zonePinSelected: { backgroundColor: COLORS.gold, transform: [{ scale: 1.15 }] },
  zonePinLabel: {
    marginTop: 3, paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: 'rgba(10,15,30,0.9)', borderRadius: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  zonePinLabelText: { color: '#fff', fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  // User dot
  userOuter: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  userPulse: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.5)',
  },
  userDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },

  // Animal pin
  animalPin: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(13,20,40,0.92)',
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    elevation: 7, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  animalPinSelected: { transform: [{ scale: 1.2 }], elevation: 12 },
  animalGlow: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, opacity: 0.45,
  },
  spreadDot: {
    position: 'absolute', top: 2, right: 2,
    width: 7, height: 7, borderRadius: 3.5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 18, paddingTop: 12, maxHeight: '72%',
  },
  sheetHandle: { width: 38, height: 4, backgroundColor: COLORS.muted, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  emptyText: { color: COLORS.subtext, fontSize: 15, textAlign: 'center', marginVertical: 36 },

  // Zone card in list
  zoneCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 12,
    gap: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  zoneCardBar: { width: 6, height: 38, borderRadius: 3 },
  zoneCardName: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 1 },
  zoneCardMeta: { color: COLORS.subtext, fontSize: 12 },

  // Detail sheet
  detailSheet: {
    position: 'absolute', bottom: 74, left: 14, right: 14,
    backgroundColor: COLORS.card, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: COLORS.border,
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: -2 },
  },
  detailClose: { position: 'absolute', top: 14, right: 14, padding: 4 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingRight: 30 },
  detailDot: { width: 10, height: 10, borderRadius: 5 },
  detailName: { color: COLORS.text, fontSize: 17, fontWeight: '800', flex: 1 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusChipText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  detailMeta: { color: COLORS.subtext, fontSize: 13, marginTop: 3 },
  detailCoord: { color: COLORS.muted, fontSize: 11, marginTop: 4, fontVariant: ['tabular-nums'] },

  // Distances
  distRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  distBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  distText: { color: COLORS.text, fontSize: 11, fontWeight: '600' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
});
