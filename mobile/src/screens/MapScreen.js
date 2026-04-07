import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, 
  ActivityIndicator, Modal, FlatList, ScrollView, Animated
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import useAnimalStore from '../store/animalStore';
import useGeofenceStore from '../store/geofenceStore';
import { isPointInPolygon } from '../utils/geoUtils';

const { width, height } = Dimensions.get('window');

const STATUS_COLOR = {
  safe: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  offline: '#94A3B8'
};

const COLORS = {
  primary: '#4F46E5',
  background: '#0A0F1E',
  surface: '#131929',
  card: '#1E2A45',
  text: '#F0F4FF',
  subtext: '#94A3B8',
  danger: '#EF4444',
  success: '#22C55E',
  border: 'rgba(255,255,255,0.08)',
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const { animals, fetchAnimals, isLoading } = useAnimalStore();
  const { geofences, fetchGeofences } = useGeofenceStore();
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [showZonesList, setShowZonesList] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);

  useEffect(() => {
    fetchAnimals();
    fetchGeofences();
    
    // Auto-center on user upon load
    centerOnUser();

    const interval = setInterval(fetchAnimals, 5000);
    return () => clearInterval(interval);
  }, []);

  const centerOnUser = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Refusée',
          'L\'accès à la localisation est nécessaire pour vous situer sur la carte. Veuillez l\'activer dans vos paramètres.'
        );
        return;
      }

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coord = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      
      setUserLocation(coord);
      mapRef.current?.animateToRegion({
        ...coord,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    } catch (err) {
      Alert.alert('Erreur GPS', 'Impossible de récupérer votre position. Vérifiez que votre GPS est bien activé.');
    }
  };

  const fitAllZones = () => {
    if (!geofences || geofences.length === 0) return;
    
    const allCoords = geofences.flatMap(gf => {
      if (gf.type === 'polygon' && gf.polygon_coords) {
        return typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
      }
      return [];
    });

    if (allCoords.length > 0) {
      mapRef.current?.fitToCoordinates(allCoords, {
        edgePadding: { top: 50, right: 50, bottom: 150, left: 50 },
        animated: true,
      });
    }
    setShowZonesList(true);
  };

  const focusZone = (gf) => {
    setShowZonesList(false);
    if (!gf.center_lat || !gf.center_lon) return;

    if (gf.type === 'polygon' && gf.polygon_coords) {
      const coords = typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 100, bottom: 250, left: 100 },
        animated: true,
      });
    } else {
      mapRef.current?.animateToRegion({
        latitude: parseFloat(gf.center_lat),
        longitude: parseFloat(gf.center_lon),
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
    
    // Select the zone to show stats
    const coords = typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
    const animalsInside = animals.filter(a => !!a.latitude && isPointInPolygon({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) }, coords)).length;
    setSelectedAnimal({ isZone: true, ...gf, animalsInside, area: gf.area_sqm });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        mapType="hybrid"
        initialRegion={{
          latitude: 35.038,
          longitude: 9.484,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {/* Render Geofences */}
        {geofences.map((gf) => {
          if (gf.type === 'polygon' && gf.polygon_coords) {
            const coords = typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
            return (
              <Polygon
                key={`poly-${gf.id}`}
                coordinates={coords}
                fillColor={gf.fill_color ? `${gf.fill_color}44` : 'rgba(79, 70, 229, 0.2)'}
                strokeColor={gf.fill_color || COLORS.primary}
                strokeWidth={2}
              />
            );
          }
          return null;
        })}

        {/* Zone Markers (Centers) with Labels */}
        {geofences.map((gf) => {
          if (!gf.center_lat || !gf.center_lon) return null;
          return (
            <Marker
              key={`marker-${gf.id}`}
              coordinate={{ latitude: parseFloat(gf.center_lat), longitude: parseFloat(gf.center_lon) }}
              onPress={() => focusZone(gf)}
            >
              <View style={styles.zoneMarkerWrapper}>
                <View style={[styles.farmMarker, gf.is_primary && { borderColor: COLORS.success }]}>
                  <Ionicons name="location" size={18} color={gf.is_primary ? COLORS.success : COLORS.primary} />
                </View>
                {gf.name && (
                  <View style={styles.zoneLabelContainer}>
                    <Text style={styles.zoneLabelText} numberOfLines={1}>
                      {gf.name} • {(gf.area_sqm / 10000).toFixed(2)} Ha
                    </Text>
                  </View>
                )}
              </View>
            </Marker>
          );
        })}

        {/* User Location Marker */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Ma Position"
            zIndex={100}
          >
            <View style={styles.userMarker}>
              <Ionicons name="person-circle" size={24} color="#4F46E5" />
            </View>
          </Marker>
        )}

        {/* Animal Markers */}
        {animals.map((animal) => (
          <Marker
            key={animal.id}
            coordinate={{
              latitude: parseFloat(animal.latitude),
              longitude: parseFloat(animal.longitude)
            }}
            onPress={() => setSelectedAnimal({ ...animal, isZone: false })}
          >
            <View style={[styles.animalMarker, { borderColor: STATUS_COLOR[animal.status] || COLORS.offline }]}>
              <Ionicons name="paw" size={16} color={STATUS_COLOR[animal.status] || COLORS.offline} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top Controls */}
      <View style={[styles.dualButtonContainer, { top: insets.top + 10 }]}>
        <TouchableOpacity style={styles.mainControlBtn} onPress={centerOnUser}>
          <Ionicons name="navigate-circle" size={20} color={COLORS.primary} />
          <Text style={styles.btnLabel}>Ma Position</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.mainControlBtn} onPress={fitAllZones}>
          <Ionicons name="map-outline" size={20} color={COLORS.primary} />
          <Text style={styles.btnLabel}>Mes Zones</Text>
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
            
            <FlatList
              data={geofences}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.zonesGrid}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune zone créée</Text>}
              renderItem={({ item }) => {
                const coords = typeof item.polygon_coords === 'string' ? JSON.parse(item.polygon_coords) : item.polygon_coords;
                const animalsInside = animals.filter(a => !!a.latitude && isPointInPolygon({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) }, coords)).length;
                
                return (
                  <TouchableOpacity style={styles.zoneQuickCard} onPress={() => focusZone(item)}>
                    <View style={[styles.typeMarker, { backgroundColor: item.fill_color || COLORS.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.zoneQuickName}>{item.name || `Zone #${item.id}`}</Text>
                      <Text style={styles.zoneQuickMeta}>
                        📂 {item.zone_type} · {(item.area_sqm / 10000).toFixed(2)} Ha · {animalsInside} Animaux
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.subtext} />
                  </TouchableOpacity>
                );
              }}
            />
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
  animalMarker:   { backgroundColor:'#FFF', padding:4, borderRadius:12, borderWidth:2 },
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
  zoneMarkerWrapper: { alignItems: 'center', justifyContent: 'center' },
  zoneLabelContainer: { backgroundColor: 'rgba(19,25,41,0.85)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 1, elevation: 2 },
  zoneLabelText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  userMarker: { backgroundColor: '#FFF', borderRadius: 15, padding: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
});
