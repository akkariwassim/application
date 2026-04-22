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

// ── Offset a point by (dLatM, dLonM) metres ──────────────────────────────────
function offsetCoord(lat, lon, dLatM, dLonM) {
  return {
    latitude:  lat + dLatM / 111320,
    longitude: lon + dLonM / (111320 * Math.cos(lat * Math.PI / 180)),
  };
}

/**
 * Lightweight Grid-based Clustering
 * Groups markers into cells based on the zoom level.
 */
function getClusters(animals, region, clusterRadius = 40) {
  if (!animals.length || !region) return [];
  
  // 1. Convert clusterRadius from screen pixels to GPS coordinates approx
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
    
    // Find neighbors in the same grid cell
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
      // Create Cluster
      const avgLat = group.reduce((s, x) => s + parseFloat(x.latitude), 0) / group.length;
      const avgLon = group.reduce((s, x) => s + parseFloat(x.longitude), 0) / group.length;
      clusters.push({
        id: `cluster-${i}`,
        isCluster: true,
        count: group.length,
        latitude: avgLat,
        longitude: avgLon,
        animals: group
      });
    } else {
      clusters.push({ ...a, isCluster: false });
    }
  }
  return clusters;
}

// Safety helper for parsing legacy or malformed polygon data
function safeParseCoords(coordsData) {
  if (!coordsData) return [];
  try {
    const raw = typeof coordsData === 'string' ? JSON.parse(coordsData) : coordsData;
    if (!Array.isArray(raw)) return [];
    
    // Normalize to {latitude, longitude}
    return raw.map(p => {
      if (!p) return null;
      if (typeof p.latitude === 'number' && typeof p.longitude === 'number') return p;
      if (Array.isArray(p) && p.length >= 2) return { latitude: parseFloat(p[1]), longitude: parseFloat(p[0]) };
      return null;
    }).filter(Boolean);
  } catch (err) {
    console.warn('[MapScreen] Error parsing coords:', err);
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
  const [currentRegion,   setCurrentRegion]   = useState(null);
  
  // ── Spiderfy State ──
  const [spiderfyData, setSpiderfyData] = useState(null); // { center, animals, positions }
  const [pulseAnim]                     = useState(new Animated.Value(0));
  const [mapState, setMapState] = useState(MAP_STATES.INITIALIZING);
  const [mapType, setMapType]   = useState('hybrid');
  const [lastSyncDiff, setLastSyncDiff] = useState(0);
  const [followUser, setFollowUser]     = useState(true);
  const [isMapReady, setIsMapReady]     = useState(false);
  const [hasLocation, setHasLocation]   = useState(false);
  const [initialCentered, setInitialCentered] = useState(false);

  const locationSub = useRef(null);
  const mapReadyRef = useRef(false);

  // ── Initialization & State Machine ──
  useEffect(() => {
    fetchAnimals();
    fetchGeofences();

    // Start pulse animation loop
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
      cleanupTracking();
    };
  }, []);

  const cleanupTracking = () => {
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }
  };

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
    
    // Custom grid clustering
    return getClusters(filtered, currentRegion, 35); 
  }, [animals, selectedAnimal?.id, selectedAnimal?.isZone, currentRegion]);

  // ── GPS tracking ────────────────────────────────────────────────────────
  const startTracking = async () => {
    try {
      setMapState(MAP_STATES.INITIALIZING);
      
      // ── Safety Timeout ──
      // Force Map to show READY after 5 seconds regardless of GPS lock
      const initializationTimeout = setTimeout(() => {
        setMapState(prev => prev === MAP_STATES.INITIALIZING ? MAP_STATES.READY : prev);
      }, 5000);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        clearTimeout(initializationTimeout);
        setMapState(MAP_STATES.DENIED);
        return;
      }

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        clearTimeout(initializationTimeout);
        setMapState(MAP_STATES.NO_GPS);
        return;
      }

      // Initial Lock with 4s internal race to prevent hanging
      const initial = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('GPS Timeout')), 4000))
      ]).catch(() => null);

      if (initial) {
        const initialLoc = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
        setUserLocation(initialLoc);
        setHasLocation(true);
      } else {
        // Fallback: Use first geofence center if GPS is slow
        if (geofences.length > 0) {
          const first = geofences[0];
          const coords = safeParseCoords(first.polygon_coords);
          if (coords.length > 0) {
            setUserLocation(coords[0]);
          }
        }
      }

      clearTimeout(initializationTimeout);
      setMapState(MAP_STATES.READY);
      
      // Watch with throttling: only update if distance > 5m
      cleanupTracking();
      locationSub.current = await Location.watchPositionAsync(
        { 
          accuracy: Location.Accuracy.Balanced, 
          timeInterval: 5000, 
          distanceInterval: 10 
        },
        loc => {
          const newLoc = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(prev => {
            if (!prev) return newLoc;
            const dist = getDistance(prev, newLoc);
            if (dist < 10) return prev;
            return newLoc;
          });
        }
      );
    } catch (err) {
      console.error('[MapScreen] Tracking error:', err);
      // Even on error, show the map ready so user can see zones
      setMapState(prev => prev === MAP_STATES.INITIALIZING ? MAP_STATES.READY : prev);
    }
  };

  useFocusEffect(
    useCallback(() => {
      startTracking();
      return () => cleanupTracking();
    }, [])
  );

  // ── Camera Control (User or Selected Animal) ──
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;

    // Type 1: Follow Selected Animal (Priority)
    if (selectedAnimal && !selectedAnimal.isZone && !selectedAnimal.manualMove) {
      // Find latest position in animals array (store) for the selected animal
      const latest = animals.find(a => a.id === selectedAnimal.id || a._id === selectedAnimal.id);
      if (latest) {
        mapRef.current.animateCamera({
          center: { latitude: parseFloat(latest.latitude), longitude: parseFloat(latest.longitude) },
          pitch: 45, // Pro 3D angle
          heading: 0,
          altitude: 1000,
          zoom: 17
        }, { duration: 1000 });
      }
    } 
    // Type 2: Follow User
    else if (followUser && userLocation && !selectedAnimal) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  }, [userLocation, animals, followUser, selectedAnimal?.id]);

  const handleMapReady = () => {
    if (!mapReadyRef.current) {
      mapReadyRef.current = true;
      setIsMapReady(true);
      
      // Trigger initial centering after small delay to ensure engine stabilized
      setTimeout(() => {
        if (userLocation) {
          recenterOnUser(false);
          setInitialCentered(true);
        } else {
          fitAllZones(false);
        }
      }, 500);
    }
  };



  const recenterOnUser = (manual = true) => {
    if (!userLocation || !isMapReady || !mapRef.current) return;
    try {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, manual ? 1000 : 700);
    } catch (err) {
      console.warn('[MapScreen] Animation failed:', err);
    }
  };

  // ── Fit All Zones ──
  const fitAllZones = (openList = true) => {
    if (!isMapReady || !mapRef.current) return;
    const allCoords = geofences.flatMap(gf => {
      if (gf.type === 'polygon' || gf.polygon_coords) {
        return safeParseCoords(gf.polygon_coords);
      }
      return [];
    });
    if (allCoords.length > 0) {
      try {
        mapRef.current.fitToCoordinates(allCoords, {
          edgePadding: { top: 100, right: 60, bottom: 200, left: 60 },
          animated: true,
        });
      } catch (err) {
        console.warn('[MapScreen] Fit coordinates failed:', err);
      }
    }
    if (openList) setShowZonesList(true);
  };

  const focusZone = (gf) => {
    setShowZonesList(false);
    if ((gf.type === 'polygon' || gf.polygon_coords)) {
      const coords = safeParseCoords(gf.polygon_coords);
      if (coords?.length) {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 120, right: 120, bottom: 280, left: 120 },
          animated: true,
        });
      }
    } else if (gf.center_lat) {
      mapRef.current?.animateToRegion({
        latitude: parseFloat(gf.center_lat), longitude: parseFloat(gf.center_lon),
        latitudeDelta: 0.005, longitudeDelta: 0.005,
      }, 700);
    }
    const zoneId = String(gf.id || gf._id);
    const animalsInside = animals.filter(a => String(a.current_zone_id || '') === zoneId).length;
    setTimeout(() =>
      setSelectedAnimal({ isZone: true, ...gf, id: zoneId, animalsInside, area: gf.area_sqm }), 100);
  };

  const handleClusterPress = (cluster, clusterChildren) => {
    // If we're already very zoomed in, spiderfy the cluster instead of zooming more
    if (currentRegion && currentRegion.latitudeDelta < 0.001) {
      setFollowUser(false); // Disable follow when inspecting clusters
      const coords = cluster.geometry.coordinates;
      const center = { latitude: coords[1], longitude: coords[0] };
      const children = clusterChildren.map(c => c.properties.item);
      const positions = getSpiderfyPositions(children.length, center);
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSpiderfyData({ center, animals: children, positions });
      return;
    }
  };

  // ── Memoized Map Components (Performance Core) ──
  const mapZones = useMemo(() => {
    return geofences.map(gf => {
      if (!gf.polygon_coords) return null;
      const coords = safeParseCoords(gf.polygon_coords);
      if (coords.length === 0) return null;
      const gfId = String(gf.id || gf._id);
      const isSelected = selectedAnimal?.isZone && String(selectedAnimal.id) === gfId;
      const baseColor = gf.fill_color || COLORS.primary;

      return (
        <React.Fragment key={`zone-${gfId}`}>
          <Polygon
            coordinates={coords}
            fillColor={isSelected ? `${COLORS.gold}22` : `${baseColor}22`}
            strokeColor={isSelected ? COLORS.gold : baseColor}
            strokeWidth={isSelected ? 3 : 1.5}
            tappable={true}
            onPress={() => focusZone(gf)}
          />
        </React.Fragment>
      );
    });
  }, [geofences, selectedAnimal?.id, selectedAnimal?.isZone]);

  const animalMarkers = useMemo(() => {
    if (spiderfyData) return null;
    return animals.map(animal => (
      <AnimalMarker
        key={animal.id}
        animal={animal}
        isSelected={selectedAnimal?.id === animal.id}
        onPress={() => setSelectedAnimal({ ...animal, isZone: false })}
      />
    ));
  }, [animals, selectedAnimal?.id, !!spiderfyData]);

  const clearSpiderfy = useCallback(() => {
    if (spiderfyData) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSpiderfyData(null);
    }
  }, [!!spiderfyData]);

  const resetMap = () => {
    mapReadyRef.current = false;
    setIsMapReady(false);
    setInitialCentered(false);
    startTracking();
    setTimeout(() => {
      mapReadyRef.current = true;
      setIsMapReady(true);
    }, 1000);
  };

  const handleMarkerAnim = (animalId, newCoord) => {
    // If we had marker refs, we would animate them here
    // For now, state-based updates are throttled in animalStore to keep it smooth
  };

  const currentStatus = mapState;

  // ── Render Helpers ──
  const renderLoading = () => (
    <View style={styles.fullscreenOverlay}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loaderText}>Initialisation SIG...</Text>
      <Text style={styles.loaderSub}>Synchronisation avec les colliers IOT</Text>
    </View>
  );

  const renderPartialHUD = () => (
    <View style={styles.partialHUD}>
      <ActivityIndicator size="small" color={COLORS.primary} />
      <Text style={styles.partialHUDText}>Signal GPS en cours...</Text>
    </View>
  );

  const renderError = (icon, title, sub, btnText, action) => (
    <View style={styles.fullscreenOverlay}>
      <Ionicons name={icon} size={64} color={COLORS.danger} />
      <Text style={[styles.loaderText, { marginTop: 16 }]}>{title}</Text>
      <Text style={styles.loaderSub}>{sub}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={action}>
        <Text style={styles.retryBtnText}>{btnText}</Text>
      </TouchableOpacity>
    </View>
  );

  // Still show fullscreen loader for at least 3 seconds or until basic map SDK ready
  if (mapState === MAP_STATES.INITIALIZING) return <View style={styles.container}>{renderLoading()}</View>;
  if (mapState === MAP_STATES.DENIED) return <View style={styles.container}>{renderError('lock-closed', 'Accès Refusé', 'Veuillez autoriser la localisation dans les réglages.', 'Ouvrir Réglages', startTracking)}</View>;
  if (mapState === MAP_STATES.NO_GPS) return <View style={styles.container}>{renderError('locate', 'GPS Désactivé', 'Activez votre signal GPS pour voir votre position.', 'Réessayer', startTracking)}</View>;

  return (
    <View style={styles.container}>
      {/* Non-blocking sync HUD */}
      {!hasLocation && renderPartialHUD()}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        onRegionChangeComplete={(region, info) => {
          setCurrentRegion(region);
          if (info?.isGesture) {
            setFollowUser(false);
            if (selectedAnimal) setSelectedAnimal(prev => prev ? { ...prev, manualMove: true } : null);
          }
        }}
        onPress={clearSpiderfy}
        onMapReady={() => {
          mapReadyRef.current = true;
          if (userLocation) recenterOnUser(false);
        }}
        initialRegion={{ latitude: 35.038, longitude: 9.484, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        clusteringEnabled={!spiderfyData}
        clusterColor={COLORS.primary}
        clusterTextColor={COLORS.white}
        onClusterPress={handleClusterPress}
      >
        {mapZones}

        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={1000}>
            <View style={styles.userDotContainer}>
              <Animated.View 
                style={[
                  styles.userPulse, 
                  { 
                    transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })
                  }
                ]} 
              />
              <View style={styles.userInternal}>
                <Ionicons name="navigate" size={12} color={COLORS.white} />
              </View>
            </View>
          </Marker>
        )}

        {/* ── Clusters & Markers ── */}
        {visibleAnimals.map(item => {
          if (item.isCluster) {
            return (
              <Marker
                key={item.id}
                coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                onPress={() => {
                  mapRef.current?.animateToRegion({
                    latitude: item.latitude,
                    longitude: item.longitude,
                    latitudeDelta: (currentRegion?.latitudeDelta || 0.02) / 4,
                    longitudeDelta: (currentRegion?.longitudeDelta || 0.02) / 4,
                  }, 600);
                }}
              >
                <View style={styles.clusterMarker}>
                  <View style={styles.clusterInner}>
                    <Text style={styles.clusterText}>{item.count}</Text>
                  </View>
                </View>
              </Marker>
            );
          }

          const isSelAnimal = !selectedAnimal?.isZone && selectedAnimal?.id === item.id;
          const color = STATUS_COLOR[item.status] || STATUS_COLOR.offline;
          const typeIcon = item.type === 'equine' ? 'horse-variant'
            : item.type === 'bovine' ? 'cow'
            : item.type === 'ovine' ? 'sheep' : 'paw';

          return (
            <Marker
              key={`anim-${item.id}`}
              coordinate={{ latitude: parseFloat(item.latitude), longitude: parseFloat(item.longitude) }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              zIndex={isSelAnimal ? 50 : 10}
              onPress={() => setSelectedAnimal({ ...item, isZone: false })}
            >
              <View style={[
                styles.animalPin,
                { borderColor: color },
                isSelAnimal && styles.animalPinSelected,
              ]}>
                <MaterialCommunityIcons name={typeIcon} size={17} color={color} />
                {isSelAnimal && <View style={[styles.animalGlow, { borderColor: color }]} />}
              </View>
            </Marker>
          );
        })}

        {selectedAnimal && !selectedAnimal.isZone && userLocation && (
          <Polyline
            coordinates={[
              userLocation,
              { latitude: parseFloat(selectedAnimal.latitude), longitude: parseFloat(selectedAnimal.longitude) },
            ]}
            strokeColor={COLORS.primary}
            strokeWidth={2}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      {/* ── Professional HUD ── */}
      <MapControls 
        followUser={followUser}
        onToggleFollow={() => {
          if (selectedAnimal) {
            // If following an animal, toggle manual mode instead of followUser
            setSelectedAnimal(prev => prev ? { ...prev, manualMove: !prev.manualMove } : null);
          } else {
            setFollowUser(!followUser);
            if (!followUser) recenterOnUser(true);
          }
        }}
        onRecenter={() => {
          if (selectedAnimal) {
             setSelectedAnimal(prev => prev ? { ...prev, manualMove: false } : null);
          } else {
            setFollowUser(true);
            recenterOnUser(true);
          }
        }}
        mapType={mapType}
        onToggleMapType={() => setMapType(prev => prev === 'hybrid' ? 'standard' : 'hybrid')}
        showZones={true}
        onToggleZones={() => setShowZonesList(true)}
        onResetMap={startTracking}
        selectedAnimal={selectedAnimal}
      />

      {!selectedAnimal && !showZonesList && (
        <View style={[styles.fabCol, { bottom: insets.bottom + 100 }]}>
          <TouchableOpacity 
            style={styles.diagFAB} 
            onPress={resetMap}
          >
            <Ionicons name="refresh" size={20} color={COLORS.white} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.recenterFAB, followUser && { backgroundColor: COLORS.success }]} 
            onPress={() => {
              setFollowUser(true);
              recenterOnUser(true);
            }}
          >
            <Ionicons name={followUser ? "walk" : "navigate-circle"} size={32} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}

      {selectedAnimal && (
        <View style={[styles.detailSheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.sheetHandle} />
          
          <View style={styles.detailHeader}>
            <View style={[styles.detailIcon, { backgroundColor: selectedAnimal.isZone ? COLORS.primary : COLORS.status[selectedAnimal.status] || COLORS.status.offline }]}>
              <Ionicons 
                name={selectedAnimal.isZone ? 'shield-checkmark' : 'paw'} 
                size={22} 
                color={COLORS.white} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{selectedAnimal.name || 'Animal'}</Text>
              <Text style={styles.detailSubtitle}>
                {selectedAnimal.isZone ? `${(selectedAnimal.area / 10000).toFixed(2)} Ha · ${selectedAnimal.animalsInside} animaux` : `${selectedAnimal.type} · ${selectedAnimal.breed || 'Sans race'}`}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.detailActionBtn}
              onPress={() => selectedAnimal.isZone ? navigation.navigate('ZonesList') : navigation.navigate('Animals', { screen: 'AnimalDetail', params: { animal: selectedAnimal } })}
            >
              <Text style={styles.detailActionText}>Détails</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {!selectedAnimal.isZone && (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="thermometer" size={16} color={COLORS.danger} />
                <Text style={styles.statVal}>{selectedAnimal.temperature || '—'}°C</Text>
                <Text style={styles.statLab}>Temp.</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="heart" size={16} color={COLORS.primary} />
                <Text style={styles.statVal}>{selectedAnimal.heart_rate || '—'}</Text>
                <Text style={styles.statLab}>BPM</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="battery-dead" size={16} color={COLORS.success} />
                <Text style={styles.statVal}>{selectedAnimal.battery_level || '—'}%</Text>
                <Text style={styles.statLab}>Batterie</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <Modal
        visible={showZonesList}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowZonesList(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowZonesList(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.modalTitle}>Mes Parcelles & Zones</Text>
              <TouchableOpacity onPress={() => setShowZonesList(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={geofences}
              keyExtractor={(item) => String(item.id || item._id)}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => {
                const zoneId = String(item.id || item._id);
                const isActive = String(selectedAnimal?.id) === zoneId;
                return (
                  <TouchableOpacity 
                    style={[styles.zoneMiniItem, isActive && styles.zoneMiniItemActive]}
                    onPress={() => focusZone(item)}
                  >
                    <View style={[styles.zoneDot, { backgroundColor: item.fill_color || COLORS.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.zoneMiniName}>{item.name || 'Zone sans nom'}</Text>
                      <Text style={styles.zoneMiniSub}>
                        {item.zone_type || 'grazing'} · {(item.area_sqm / 10000).toFixed(1)} Ha
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>Aucune zone configurée</Text>
                  <TouchableOpacity 
                    style={styles.modalEmptyBtn}
                    onPress={() => { setShowZonesList(false); navigation.navigate('Geofence'); }}
                  >
                    <Text style={styles.modalEmptyBtnText}>Créer une zone</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {(isLoading || !isMapReady || !hasLocation) && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ color: COLORS.white, marginTop: 12, fontWeight: '700', textAlign: 'center' }}>
            Initialisation du Moteur de Carte...{"\n"}
            <Text style={{ color: COLORS.textMuted, fontSize: 10 }}>Vérification des signaux GPS et IOT</Text>
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  fullscreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  loaderText: { color: COLORS.white, fontSize: 18, fontWeight: '800', marginTop: 20 },
  loaderSub: { color: COLORS.textMuted, fontSize: 13, marginTop: 8 },
  retryBtn: { 
    marginTop: 32, 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 12 
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700' },

  partialHUD: {
    position: 'absolute',
    top: 150,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 1000,
  },
  partialHUDText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10,
  },
  topBtnClear: { borderColor: `${COLORS.gold}55` },
  topBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  
  // Clusters
  clusterMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.4)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.6)',
  },
  clusterInner: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
  },
  clusterText: { color: '#fff', fontSize: 13, fontWeight: '800' },

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
    position: 'absolute', width: 30, height: 30, borderRadius: 15,
    backgroundColor: `${COLORS.primary}66`,
  },
  userInternal: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.soft
  },

  // Floating Bar
  topBar: { position: 'absolute', left: SPACING.md, right: SPACING.md, flexDirection: 'row', gap: SPACING.sm, zIndex: 1000 },
  controlBtn: {
    flex: 1, height: 48, backgroundColor: 'rgba(10, 15, 30, 0.95)', 
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...SHADOWS.soft
  },
  controlBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.white },
  controlBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  controlBtnTextActive: { color: COLORS.white },

  fabCol: { position: 'absolute', right: SPACING.lg, alignItems: 'center', gap: SPACING.md },
  recenterFAB: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.hard,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)'
  },
  diagFAB: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(10, 15, 30, 0.8)',
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.soft,
    borderWidth: 1, borderColor: COLORS.border
  },

  // Detail Sheet
  detailSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.card, borderTopLeftRadius: 30, borderTopRightRadius: 30,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.hard
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.divider, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  detailIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  detailSubtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  detailActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, 
    backgroundColor: `${COLORS.primary}15`, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10
  },
  detailActionText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  // Stats Grid
  statsGrid: { flexDirection: 'row', gap: SPACING.md },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, 
    padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border
  },
  statVal: { color: COLORS.white, fontSize: 16, fontWeight: '800', marginTop: 8 },
  statLab: { color: COLORS.textDim, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },

  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 18, 0.6)', alignItems: 'center', justifyContent: 'center' },

  // Mini Zones Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: COLORS.card, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    height: '60%', 
    paddingTop: 12 
  },
  modalHeader: { paddingHorizontal: 24, paddingBottom: 16, alignItems: 'center' },
  modalTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800', marginTop: 16 },
  modalCloseBtn: { position: 'absolute', right: 20, top: 20, padding: 4 },
  modalList: { padding: 20 },
  zoneMiniItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.surface, 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: COLORS.border 
  },
  zoneMiniItemActive: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}11` },
  zoneDot: { width: 10, height: 10, borderRadius: 5, marginRight: 16 },
  zoneMiniName: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  zoneMiniSub: { color: COLORS.textDim, fontSize: 11, marginTop: 2 },
  modalEmpty: { alignItems: 'center', marginTop: 60 },
  modalEmptyText: { color: COLORS.textDim, fontSize: 14 },
  modalEmptyBtn: { marginTop: 16, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  modalEmptyBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
});
