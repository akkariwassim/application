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

export default function MapScreen() {
  const insets   = useSafeAreaInsets();
  const { animals, fetchAnimals, isLoading } = useAnimalStore();
  const { geofences, fetchGeofences } = useGeofenceStore();
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [mapRef, setMapRef]   = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    const init = async () => {
      await fetchAnimals();
      const zones = await fetchGeofences();
      await requestLocationPermission();
      
      // Auto-center on the primary farm zone if it exists
      if (zones && zones.length > 0) {
        const primaryZone = zones.find(z => z.is_active) || zones[0];
        if (primaryZone.center_lat && primaryZone.center_lon && mapRef) {
          mapRef.animateToRegion({
            latitude: parseFloat(primaryZone.center_lat),
            longitude: parseFloat(primaryZone.center_lon),
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }, 1500);
        }
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
        // Smooth transition to user location if permitted
        if (mapRef) {
          mapRef.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }, 1500);
        }
      }
    } catch (err) {
      console.warn('[Map] Location permission error:', err);
    }
  };

  useEffect(() => {
    animals.forEach((a) => subscribeAnimal(a.id));
  }, [animals.length]);

  const validAnimals = animals.filter(
    (a) => a.latitude != null && a.longitude != null &&
           (filterStatus ? a.status === filterStatus : true)
  );

  const fitAll = useCallback(() => {
    if (!mapRef || validAnimals.length === 0) return;
    mapRef.fitToCoordinates(
      validAnimals.map((a) => ({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) })),
      { edgePadding: { top: 80, right: 40, bottom: 120, left: 40 }, animated: true }
    );
  }, [mapRef, validAnimals]);

  const initialRegion = DEFAULT_LOCATION;

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

  const goToFarm = () => {
    mapRef?.animateToRegion(DEFAULT_LOCATION, 1000);
  };

  const FilterBtn = ({ status, label }) => (
    <TouchableOpacity
      style={[styles.filterBtn, filterStatus === status && { backgroundColor: STATUS_COLOR[status] + '33', borderColor: STATUS_COLOR[status] }]}
      onPress={() => setFilterStatus(filterStatus === status ? null : status)}
    >
      <Text style={[styles.filterText, filterStatus === status && { color: STATUS_COLOR[status] }]}>{label}</Text>
    </TouchableOpacity>
  );

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
        onMapReady={fitAll}
      >
        {validAnimals.map((animal) => {
          const lat = parseFloat(animal.latitude);
          const lon = parseFloat(animal.longitude);
          const color = STATUS_COLOR[animal.status] || COLORS.offline;

          return (
            <React.Fragment key={animal.id}>
              {/* Geofence circle */}
              {animal.center_lat && animal.radius_m && (
                <Circle
                  center={{ latitude: parseFloat(animal.center_lat), longitude: parseFloat(animal.center_lon) }}
                  radius={parseFloat(animal.radius_m)}
                  strokeColor={color + '99'}
                  fillColor={color + '22'}
                  strokeWidth={2}
                />
              )}
              {/* Animal marker */}
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

        {/* Polygon Geofences */}
        {geofences.map((gf) => {
          const coords = gf.polygon_coords ? (typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords) : [];
          if (gf.type === 'polygon' && coords.length > 0) {
            return (
              <Polygon
                key={gf.id}
                coordinates={coords}
                strokeColor={COLORS.primary + 'AA'}
                fillColor={COLORS.primary + '22'}
                strokeWidth={2}
              />
            );
          }
          return null;
        })}

        {/* Farm (Default/Zone Location) Marker */}
        {(() => {
          const activeZone = geofences.find(z => z.is_active) || geofences[0];
          const farmLat = activeZone?.center_lat ? parseFloat(activeZone.center_lat) : DEFAULT_LOCATION.latitude;
          const farmLon = activeZone?.center_lon ? parseFloat(activeZone.center_lon) : DEFAULT_LOCATION.longitude;
          
          return (
            <Marker
              coordinate={{ latitude: farmLat, longitude: farmLon }}
              title={activeZone ? `Zone #${activeZone.id} Center` : FARM_METADATA.name}
              description={activeZone ? "Calculated zone center" : FARM_METADATA.description}
            >
              <View style={styles.farmMarker}>
                <Ionicons name="home" size={24} color={COLORS.primary} />
              </View>
            </Marker>
          );
        })()}
      </MapView>

      {/* Floating Action Buttons */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 85 }]}>
        <TouchableOpacity style={styles.fab} onPress={goToFarm} activeOpacity={0.8}>
          <Ionicons name="business" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={goToMyLocation} activeOpacity={0.8}>
          <Ionicons name="navigate" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topLeft}>
          <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
          <Text style={styles.topTitle}>Live Map</Text>
        </View>
        <View style={styles.topRight}>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Ionicons name="notifications" size={14} color={COLORS.danger} />
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => fetchAnimals()}>
            <Ionicons name="refresh" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={fitAll}>
            <Ionicons name="expand" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Row */}
      <View style={[styles.filterRow, { top: insets.top + 60 }]}>
        <FilterBtn status="safe"    label="✅ Safe" />
        <FilterBtn status="warning" label="⚠️ Warning" />
        <FilterBtn status="danger"  label="🚨 Danger" />
        <FilterBtn status="offline" label="⚫ Offline" />
      </View>

      {/* Stats Bar */}
      <View style={[styles.statsBar, { paddingBottom: insets.bottom + 8 }]}>
        {['safe','warning','danger','offline'].map((s) => {
          const count = animals.filter((a) => a.status === s).length;
          return (
            <View key={s} style={styles.statItem}>
              <Ionicons name={STATUS_ICON[s]} size={20} color={STATUS_COLOR[s]} />
              <Text style={[styles.statCount, { color: STATUS_COLOR[s] }]}>{count}</Text>
              <Text style={styles.statLabel}>{s}</Text>
            </View>
          );
        })}
      </View>

      {/* Animal Detail Bottom Sheet */}
      {selectedAnimal && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.sheetClose} onPress={() => setSelectedAnimal(null)}>
            <Ionicons name="close" size={20} color={COLORS.subtext} />
          </TouchableOpacity>
          <View style={styles.sheetHeader}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[selectedAnimal.status] }]} />
            <Text style={styles.sheetName}>{selectedAnimal.name}</Text>
            <Text style={styles.sheetBadge}>{selectedAnimal.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.sheetMeta}>{selectedAnimal.type} · {selectedAnimal.breed || 'N/A'}</Text>
          {selectedAnimal.latitude && (
            <Text style={styles.sheetCoords}>
              📍 {parseFloat(selectedAnimal.latitude).toFixed(6)}, {parseFloat(selectedAnimal.longitude).toFixed(6)}
            </Text>
          )}
          {selectedAnimal.speed_mps != null && (
            <Text style={styles.sheetMeta}>
              🏃 {(parseFloat(selectedAnimal.speed_mps) * 3.6).toFixed(1)} km/h
            </Text>
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
  topBar:         { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingBottom:12, backgroundColor:'rgba(10,15,30,0.85)' },
  topLeft:        { flexDirection:'row', alignItems:'center', gap:8 },
  topTitle:       { color:COLORS.text, fontSize:18, fontWeight:'700' },
  topRight:       { flexDirection:'row', alignItems:'center', gap:8 },
  badge:          { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(239,68,68,0.15)', borderRadius:12, paddingHorizontal:8, paddingVertical:3, gap:4 },
  badgeText:      { color:COLORS.danger, fontSize:12, fontWeight:'700' },
  iconBtn:        { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.08)', alignItems:'center', justifyContent:'center' },
  filterRow:      { position:'absolute', left:0, right:0, flexDirection:'row', paddingHorizontal:12, gap:6 },
  filterBtn:      { paddingHorizontal:12, paddingVertical:6, backgroundColor:'rgba(19,25,41,0.85)', borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  filterText:     { color:COLORS.text, fontSize:12, fontWeight:'500' },
  statsBar:       { position:'absolute', bottom:0, left:0, right:0, flexDirection:'row', backgroundColor:'rgba(10,15,30,0.92)', paddingHorizontal:8, paddingTop:14, justifyContent:'space-around' },
  statItem:       { alignItems:'center', gap:2 },
  statCount:      { fontSize:20, fontWeight:'800' },
  statLabel:      { color:COLORS.subtext, fontSize:10, textTransform:'capitalize' },
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
  fabContainer:   { position:'absolute', right:16, gap:12 },
  fab:            { width:48, height:48, borderRadius:24, backgroundColor:COLORS.card, alignItems:'center', justifyContent:'center', elevation:4, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.3, shadowRadius:4, borderWidth:1, borderColor:COLORS.border },
});
