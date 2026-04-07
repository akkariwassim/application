import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
  Dimensions, Platform,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAnimalStore from '../store/animalStore';
import useAlertStore  from '../store/alertStore';
import { subscribeAnimal } from '../services/socketService';
import useGeofenceStore from '../store/geofenceStore';
import * as Location from 'expo-location';
import { isPointInPolygon } from '../utils/geoUtils';
import { DEFAULT_LOCATION, FARM_METADATA } from '../config/mapConfig';

const { width } = Dimensions.get('window');

const COLORS = {
  primary:'#4F46E5', background:'#0A0F1E', surface:'#131929',
  card:'#1E2A45', text:'#F0F4FF', subtext:'#94A3B8',
  safe:'#22C55E', warning:'#F59E0B', danger:'#EF4444', offline:'#6B7280',
  border:'rgba(255,255,255,0.08)',
};

const STATUS_COLOR = {
  safe: COLORS.safe, warning: COLORS.warning,
  danger: COLORS.danger, offline: COLORS.offline,
};

const STATUS_ICON = {
  safe: 'checkmark-circle', warning: 'warning',
  danger: 'alert-circle', offline: 'cloud-offline',
};

export default function MapScreen({ route, navigation }) {
  const insets   = useSafeAreaInsets();
  const { animals, fetchAnimals, isLoading } = useAnimalStore();
  const { geofences, fetchGeofences } = useGeofenceStore();
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [mapRef, setMapRef]   = useState(null);
  const [showZonesList, setShowZonesList] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    const init = async () => {
      await fetchAnimals();
      const zones = await fetchGeofences();
      await requestLocationPermission();
      
      // Check for focusZone from navigation
      const focusZone = route.params?.focusZone;
      if (focusZone && mapRef) {
        const coords = typeof focusZone.polygon_coords === 'string' ? JSON.parse(focusZone.polygon_coords) : focusZone.polygon_coords;
        if (coords && coords.length > 0) {
          mapRef.animateToRegion({
            latitude: parseFloat(focusZone.center_lat),
            longitude: parseFloat(focusZone.center_lon),
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 1000);
          setSelectedAnimal({ isZone: true, ...focusZone, area: focusZone.area_sqm });
        }
      } else if (zones && zones.length > 0) {
        // Auto-fit all zones on first load
        fitAllZonesDirect(zones);
      }
    };
    init();
  }, [mapRef]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location.coords);
        setPermissionGranted(true);
      }
    } catch (err) {
      console.warn('[Map] Location permission error:', err);
    }
  };

  useEffect(() => {
    animals.forEach((a) => subscribeAnimal(a.id));
  }, [animals.length]);

  const validAnimals = animals.filter(
    (a) => a.latitude != null && a.longitude != null
  );

  const fitAll = useCallback(() => {
    if (!mapRef || validAnimals.length === 0) return;
    mapRef.fitToCoordinates(
      validAnimals.map((a) => ({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) })),
      { edgePadding: { top: 150, right: 60, bottom: 200, left: 60 }, animated: true }
    );
  }, [mapRef, validAnimals]);

  const fitAllZonesDirect = (zones = geofences) => {
    if (!zones || zones.length === 0 || !mapRef) return;
    
    let allCoords = [];
    zones.forEach(gf => {
      const coords = typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
      if (coords && Array.isArray(coords)) {
        allCoords = [...allCoords, ...coords];
      }
    });

    if (allCoords.length > 0) {
      mapRef.fitToCoordinates(allCoords, {
        edgePadding: { top: 150, right: 80, bottom: 150, left: 80 },
        animated: true,
      });
    }
  };

  const goToMyLocation = async () => {
    if (!permissionGranted) {
      await requestLocationPermission();
      return;
    }
    const location = await Location.getCurrentPositionAsync({});
    mapRef?.animateToRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 1000);
  };

  const onZonesPress = () => {
    fitAllZonesDirect();
    setShowZonesList(true);
  };

  const initialRegion = DEFAULT_LOCATION;

  return (
    <View style={styles.container}>
      <MapView
        ref={setMapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        mapType="hybrid"
        showsUserLocation
        showsCompass
      >
        {/* Animal Markers */}
        {validAnimals.map((animal) => {
          const lat = parseFloat(animal.latitude);
          const lon = parseFloat(animal.longitude);
          const color = STATUS_COLOR[animal.status] || COLORS.offline;

          return (
            <React.Fragment key={`animal-${animal.id}`}>
              {!!(animal.center_lat && animal.radius_m) && (
                <Circle
                  center={{ latitude: parseFloat(animal.center_lat), longitude: parseFloat(animal.center_lon) }}
                  radius={parseFloat(animal.radius_m)}
                  strokeColor={color + '99'}
                  fillColor={color + '22'}
                  strokeWidth={2}
                />
              )}
              <Marker
                coordinate={{ latitude: lat, longitude: lon }}
                title={animal.name}
                description={`${animal.status.toUpperCase()} • ${animal.type}`}
                pinColor={color}
                onPress={() => setSelectedAnimal(animal)}
              />
            </React.Fragment>
          );
        })}

        {/* Polygons (Zones) */}
        {geofences.map((gf) => {
          const coords = gf.polygon_coords ? (typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords) : [];
          if (gf.type === 'polygon' && coords.length > 0) {
            const animalsInside = animals.filter(a => !!a.latitude && isPointInPolygon({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) }, coords)).length;
            const isSelected = selectedAnimal?.isZone && selectedAnimal.id === gf.id;
            
            return (
              <Polygon
                key={`poly-${gf.id}`}
                coordinates={coords}
                strokeColor={isSelected ? '#FFFFFF' : (gf.fill_color || COLORS.primary + 'AA')}
                fillColor={isSelected ? (gf.fill_color || COLORS.primary) + '66' : (gf.fill_color || COLORS.primary) + '22'}
                strokeWidth={isSelected ? 4 : 2}
                tappable
                onPress={() => setSelectedAnimal({ isZone: true, ...gf, animalsInside, area: gf.area_sqm })}
              />
            );
          }
          return null;
        })}

        {/* Zone Markers (Centers) */}
        {geofences.map((gf) => {
          if (!gf.center_lat || !gf.center_lon) return null;
          return (
            <Marker
              key={`marker-${gf.id}`}
              coordinate={{ latitude: parseFloat(gf.center_lat), longitude: parseFloat(gf.center_lon) }}
              onPress={() => {
                const coords = typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
                const animalsInside = animals.filter(a => !!a.latitude && isPointInPolygon({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) }, coords)).length;
                setSelectedAnimal({ isZone: true, ...gf, animalsInside, area: gf.area_sqm });
              }}
            >
              <View style={[styles.farmMarker, gf.is_primary && { borderColor: COLORS.success }]}>
                <Ionicons name="location" size={18} color={gf.is_primary ? COLORS.success : COLORS.primary} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Primary Controls (Top) */}
      <View style={[styles.dualButtonContainer, { top: insets.top + 12 }]}>
        <TouchableOpacity 
          style={styles.mainControlBtn} 
          onPress={onZonesPress} 
          activeOpacity={0.8}
        >
          <Ionicons name="layers" size={20} color={COLORS.primary} />
          <Text style={styles.btnLabel}>Mes Zones</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.mainControlBtn} 
          onPress={goToMyLocation} 
          activeOpacity={0.8}
        >
          <Ionicons name="navigate-circle" size={20} color={COLORS.primary} />
          <Text style={styles.btnLabel}>Ma Position</Text>
        </TouchableOpacity>
      </View>

      {/* Zones List Modal */}
      <Modal
        visible={showZonesList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowZonesList(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowZonesList(false)} />
          <View style={styles.zonesBottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Mes Zones</Text>
            {geofences.length === 0 ? (
              <Text style={styles.emptyText}>Aucune zone créée</Text>
            ) : (
              <View style={styles.zonesGrid}>
                {geofences.map(gf => {
                  const coords = gf.polygon_coords ? (typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords) : [];
                  const animalsInside = animals.filter(a => !!a.latitude && isPointInPolygon({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) }, coords)).length;
                  return (
                    <TouchableOpacity 
                      key={gf.id} 
                      style={styles.zoneQuickCard}
                      onPress={() => {
                        setShowZonesList(false);
                        mapRef?.animateToRegion({
                          latitude: parseFloat(gf.center_lat),
                          longitude: parseFloat(gf.center_lon),
                          latitudeDelta: 0.005,
                          longitudeDelta: 0.005,
                        }, 1000);
                        setSelectedAnimal({ isZone: true, ...gf, animalsInside, area: gf.area_sqm });
                      }}
                    >
                      <View style={[styles.typeMarker, { backgroundColor: gf.fill_color || COLORS.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.zoneQuickName} numberOfLines={1}>{gf.name || `Zone #${gf.id}`}</Text>
                        <Text style={styles.zoneQuickMeta}>{animalsInside} animaux · {(gf.area_sqm / 10000).toFixed(1)} Ha</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.subtext} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Detail Sheet */}
      {selectedAnimal && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.sheetClose} onPress={() => setSelectedAnimal(null)}>
            <Ionicons name="close" size={20} color={COLORS.subtext} />
          </TouchableOpacity>
          <View style={styles.sheetHeader}>
            <View style={[styles.statusDot, { backgroundColor: selectedAnimal.isZone ? (selectedAnimal.fill_color || COLORS.primary) : (STATUS_COLOR[selectedAnimal.status] || COLORS.offline) }]} />
            <Text style={styles.sheetName}>{selectedAnimal.name || (selectedAnimal.isZone ? `Zone #${selectedAnimal.id}` : 'Animal')}</Text>
            <Text style={styles.sheetBadge}>{selectedAnimal.isZone ? (selectedAnimal.zone_type || 'ZONE').toUpperCase() : selectedAnimal.status.toUpperCase()}</Text>
          </View>
          
          {selectedAnimal.isZone ? (
            <>
              <Text style={styles.sheetMeta}>📐 Superficie: {(selectedAnimal.area / 10000).toFixed(2)} Ha ({parseFloat(selectedAnimal.area).toFixed(0)} m²)</Text>
              <Text style={styles.sheetMeta}>🐄 Animaux présents : {selectedAnimal.animalsInside}</Text>
              <Text style={[styles.sheetMeta, { color: COLORS.primary, marginTop: 8 }]}>Priorité: {selectedAnimal.priority_level}</Text>
            </>
          ) : (
            <>
              <Text style={styles.sheetMeta}>{selectedAnimal.type} · {selectedAnimal.breed || 'N/A'}</Text>
              <Text style={styles.sheetCoords}>📍 {parseFloat(selectedAnimal.latitude).toFixed(6)}, {parseFloat(selectedAnimal.longitude).toFixed(6)}</Text>
              {selectedAnimal.speed_mps != null && (
                <Text style={styles.sheetMeta}>🏃 {(parseFloat(selectedAnimal.speed_mps) * 3.6).toFixed(1)} km/h</Text>
              )}
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

const styles = StyleSheet.create({
  container:      { flex:1, backgroundColor: COLORS.background },
  sheet:          { position:'absolute', bottom:80, left:16, right:16, backgroundColor:COLORS.card, borderRadius:20, padding:20, borderWidth:1, borderColor:COLORS.border },
  sheetClose:     { position:'absolute', top:14, right:14 },
  sheetHeader:    { flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 },
  statusDot:      { width:10, height:10, borderRadius:5 },
  sheetName:      { color:COLORS.text, fontSize:18, fontWeight:'700', flex:1 },
  sheetBadge:     { fontSize:10, fontWeight:'700', color:COLORS.danger },
  sheetMeta:      { color:COLORS.subtext, fontSize:13, marginTop:2 },
  sheetCoords:    { color:COLORS.subtext, fontSize:12, marginTop:4 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.4)', alignItems:'center', justifyContent:'center' },
  farmMarker:     { backgroundColor:COLORS.surface, padding:6, borderRadius:15, borderWidth:2, borderColor:COLORS.primary },
  dualButtonContainer: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 10, justifyContent: 'center' },
  mainControlBtn: { flex: 1, height: 48, backgroundColor: 'rgba(19,25,41,0.92)', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4, borderWidth: 1, borderColor: COLORS.border },
  btnLabel: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  zonesBottomSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '70%' },
  sheetHandle: { width: 40, height: 5, backgroundColor: COLORS.border, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 20 },
  zonesGrid: { gap: 12 },
  zoneQuickCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 16, padding: 12, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  typeMarker: { width: 8, height: 40, borderRadius: 4 },
  zoneQuickName: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  zoneQuickMeta: { color: COLORS.subtext, fontSize: 12 },
  emptyText: { color: COLORS.subtext, fontSize: 16, textAlign: 'center', marginVertical: 40 },
});
