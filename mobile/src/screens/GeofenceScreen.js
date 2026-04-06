import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import useGeofenceStore from '../store/geofenceStore';
import useAnimalStore   from '../store/animalStore';
import { calculateCentroid } from '../utils/geoUtils';

const COLORS = {
  primary: '#4F46E5', background: '#0A0F1E', surface: '#131929',
  card: '#1E2A45', text: '#F0F4FF', subtext: '#94A3B8',
  danger: '#EF4444', success: '#22C55E', border: 'rgba(255,255,255,0.08)',
};

export default function GeofenceScreen() {
  const { geofences, fetchGeofences, createGeofence, deleteGeofence, isLoading } = useGeofenceStore();
  const { animals } = useAnimalStore();
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [newPolygon, setNewPolygon] = useState([]);
  const [mapRef, setMapRef] = useState(null);

  useEffect(() => {
    fetchGeofences();
  }, []);

  const handleMapPress = (e) => {
    if (!isDrawing) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setNewPolygon([...newPolygon, { latitude, longitude }]);
  };

  const handleSave = async () => {
    if (newPolygon.length < 3) {
      Alert.alert('Invalid Zone', 'A polygon must have at least 3 points.');
      return;
    }

    try {
      const centroid = calculateCentroid(newPolygon);
      await createGeofence({
        type: 'polygon',
        polygonCoords: newPolygon,
        centerLat: centroid.latitude,
        centerLon: centroid.longitude,
      });
      setIsDrawing(false);
      setNewPolygon([]);
      Alert.alert('Success', 'Virtual zone saved successfully.');
    } catch (err) {
      Alert.alert('Error', 'Failed to save zone.');
    }
  };

  const handleCancel = () => {
    setIsDrawing(false);
    setNewPolygon([]);
  };

  const deleteZone = (id) => {
    Alert.alert('Delete Zone', 'Are you sure you want to delete this virtual fence?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', onPress: () => deleteGeofence(id), style: 'destructive' },
    ]);
  };

  const renderGeofenceItem = ({ item }) => {
    const coords = typeof item.polygon_coords === 'string' 
      ? JSON.parse(item.polygon_coords) 
      : item.polygon_coords;
    
    return (
      <View style={styles.zoneCard}>
        <View style={styles.zoneInfo}>
          <Text style={styles.zoneTitle}>Polygon Zone #{item.id}</Text>
          <Text style={styles.zoneMeta}>{coords.length} vertices · {item.is_active ? 'Active' : 'Inactive'}</Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteZone(item.id)}>
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={setMapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          mapType="hybrid"
          onPress={handleMapPress}
          initialRegion={{
            latitude: 35.038,
            longitude: 9.484,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
        >
          {/* Existing Geofences */}
          {geofences.map((gf) => {
            const coords = gf.polygon_coords ? (typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords) : [];
            if (gf.type === 'polygon' && coords.length > 0) {
              return (
                <Polygon
                  key={gf.id}
                  coordinates={coords}
                  strokeColor={gf.is_active ? COLORS.primary : COLORS.subtext}
                  fillColor={gf.is_active ? COLORS.primary + '33' : COLORS.subtext + '22'}
                  strokeWidth={2}
                />
              );
            }
            return null;
          })}

          {/* New Polygon Preview */}
          {newPolygon.length > 0 && (
            <>
              <Polygon
                coordinates={newPolygon}
                strokeColor={COLORS.success}
                fillColor={COLORS.success + '33'}
                strokeWidth={3}
              />
              {newPolygon.map((p, i) => (
                <Marker 
                  key={i} 
                  coordinate={p} 
                  anchor={{x: 0.5, y: 0.5}}
                >
                  <View style={styles.vertexMarker} />
                </Marker>
              ))}
            </>
          )}

          {/* Animals Markers for context */}
          {animals.map((a) => a.latitude && (
            <Marker
              key={a.id}
              coordinate={{ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) }}
              title={a.name}
            >
              <Ionicons name="paw" size={20} color={COLORS.text} />
            </Marker>
          ))}
        </MapView>

        {isDrawing ? (
          <View style={styles.drawControls}>
            <TouchableOpacity style={styles.controlBtn} onPress={handleCancel}>
              <Ionicons name="close" size={20} color={COLORS.text} />
              <Text style={styles.controlText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlBtn, styles.saveBtn]} onPress={handleSave}>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={[styles.controlText, { color: '#fff' }]}>Save Zone</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.fab} onPress={() => setIsDrawing(true)}>
            <Ionicons name="add" size={30} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.listHeader}>Your Farm Zones</Text>
        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={geofences}
            renderItem={renderGeofenceItem}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No zones defined. Tap + to draw one.</Text>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  mapContainer:   { flex: 1.5, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listContainer:  { flex: 1, padding: 16 },
  listHeader:     { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  fab:            { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  drawControls:   { position: 'absolute', bottom: 20, left: 20, right: 20, flexDirection: 'row', gap: 12 },
  controlBtn:     { flex: 1, height: 48, borderRadius: 12, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  saveBtn:        { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  controlText:    { color: COLORS.text, fontWeight: '600' },
  vertexMarker:   { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success, borderWidth: 2, borderColor: '#fff' },
  zoneCard:       { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  zoneInfo:       { flex: 1 },
  zoneTitle:      { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  zoneMeta:       { color: COLORS.subtext, fontSize: 12, marginTop: 2 },
  deleteBtn:      { padding: 8 },
  emptyText:      { color: COLORS.subtext, textAlign: 'center', marginTop: 40, fontSize: 14 },
});
