import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator,
  Modal, TextInput,
} from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import useGeofenceStore from '../store/geofenceStore';
import useAnimalStore   from '../store/animalStore';
import { calculateCentroid, calculatePolygonArea } from '../utils/geoUtils';

const COLORS = {
  primary: '#4F46E5', background: '#0A0F1E', surface: '#131929',
  card: '#1E2A45', text: '#F0F4FF', subtext: '#94A3B8',
  danger: '#EF4444', success: '#22C55E', border: 'rgba(255,255,255,0.08)',
};

export default function GeofenceScreen({ route }) {
  const { geofences, fetchGeofences, createGeofence, updateGeofence, deleteGeofence, isLoading } = useGeofenceStore();
  const { animals } = useAnimalStore();
  
  const [editingId, setEditingId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newPolygon, setNewPolygon] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  
  // New state for naming modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [zoneType, setZoneType] = useState('grazing');
  const [priority, setPriority] = useState(1);
  const [fillColor, setFillColor] = useState('#4F46E5');
  const [area, setArea] = useState(0);

  useEffect(() => {
    fetchGeofences();
    
    // Check for initialZone from navigation (Edit Mode)
    const initialZone = route.params?.initialZone;
    if (initialZone) {
      setEditingId(initialZone.id);
      setIsDrawing(true);
      const coords = typeof initialZone.polygon_coords === 'string' ? JSON.parse(initialZone.polygon_coords) : initialZone.polygon_coords;
      setNewPolygon(coords || []);
      setZoneName(initialZone.name || '');
      setIsPrimary(initialZone.is_primary === 1);
      setZoneType(initialZone.zone_type || 'grazing');
      setPriority(initialZone.priority_level || 1);
      setFillColor(initialZone.fill_color || '#4F46E5');
      setArea(initialZone.area_sqm || 0);
    }
  }, [route.params?.initialZone]);

  const handleMapPress = (e) => {
    if (!isDrawing) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setNewPolygon([...newPolygon, { latitude, longitude }]);
  };

  const handleSaveFinal = async () => {
    if (!zoneName.trim()) {
      Alert.alert('Required', 'Please enter a name for this zone.');
      return;
    }

    try {
      const centroid = calculateCentroid(newPolygon);
      const polyArea = calculatePolygonArea(newPolygon);
      
      const payload = {
        type: 'polygon',
        name: zoneName,
        polygonCoords: newPolygon,
        centerLat: centroid.latitude,
        centerLon: centroid.longitude,
        isPrimary: isPrimary,
        zoneType: zoneType,
        priorityLevel: priority,
        areaSqm: polyArea,
        fillColor: fillColor,
        isActive: 1
      };

      if (editingId) {
        await updateGeofence(editingId, payload);
      } else {
        await createGeofence(payload);
      }
      
      setIsDrawing(false);
      setNewPolygon([]);
      setShowSaveModal(false);
      setEditingId(null);
      setZoneName('');
      setIsPrimary(false);
      Alert.alert('Success', `Zone "${zoneName}" ${editingId ? 'updated' : 'saved'} successfully.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to save zone.');
    }
  };

  const handleSaveRequest = () => {
    if (newPolygon.length < 3) {
      Alert.alert('Invalid Zone', 'A polygon must have at least 3 points.');
      return;
    }
    const polyArea = calculatePolygonArea(newPolygon);
    setArea(polyArea);
    setShowSaveModal(true);
  };

  const updateVertex = (index, coordinate) => {
    const updated = [...newPolygon];
    updated[index] = coordinate;
    setNewPolygon(updated);
    setArea(calculatePolygonArea(updated)); // Live area update
  };

  const removeVertex = (index) => {
    if (newPolygon.length <= 3) {
      Alert.alert('Notice', 'A polygon needs at least 3 points.');
      return;
    }
    const updated = newPolygon.filter((_, i) => i !== index);
    setNewPolygon(updated);
    setArea(calculatePolygonArea(updated)); // Live area update
  };

  const handleCancel = () => {
    setIsDrawing(false);
    setNewPolygon([]);
    setEditingId(null);
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
      <View style={[styles.zoneCard, item.is_primary && styles.primaryCard]}>
        <View style={styles.zoneInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.zoneTitle}>{item.name || `Polygon Zone #${item.id}`}</Text>
            {!!item.is_primary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryText}>PRIMARY</Text>
              </View>
            )}
          </View>
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
                  draggable
                  onDragEnd={(e) => updateVertex(i, e.nativeEvent.coordinate)}
                  onLongPress={() => removeVertex(i)}
                >
                  <View style={styles.vertexMarker} />
                </Marker>
              ))}
            </>
          )}

          {/* Animals Markers for context */}
          {animals.map((a) => !!a.latitude && (
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
            <TouchableOpacity style={[styles.controlBtn, styles.saveBtn]} onPress={handleSaveRequest}>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={[styles.controlText, { color: '#fff' }]}>Save Zone</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.fab} onPress={() => setIsDrawing(true)}>
            <Ionicons name="add" size={30} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Save Modal */}
        <Modal
          visible={showSaveModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSaveModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Zone Details</Text>
              
              <Text style={styles.label}>Unique Name</Text>
              <TextInput
                style={styles.input}
                value={zoneName}
                onChangeText={setZoneName}
                placeholder="e.g. North Pasture"
                placeholderTextColor={COLORS.subtext}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Type</Text>
                  <View style={styles.pickerContainer}>
                    <TouchableOpacity onPress={() => setZoneType('grazing')} style={[styles.typeBtn, zoneType === 'grazing' && styles.activeType]}>
                      <Text style={styles.typeBtnText}>Grazing</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setZoneType('water')} style={[styles.typeBtn, zoneType === 'water' && styles.activeType]}>
                      <Text style={styles.typeBtnText}>Water</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setZoneType('rest')} style={[styles.typeBtn, zoneType === 'rest' && styles.activeType]}>
                      <Text style={styles.typeBtnText}>Rest</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Area: {(area / 10000).toFixed(2)} Ha ({area.toFixed(0)} m²)</Text>

              <TouchableOpacity 
                style={styles.toggleRow} 
                onPress={() => setIsPrimary(!isPrimary)}
              >
                <Ionicons 
                  name={isPrimary ? "checkbox" : "square-outline"} 
                  size={24} 
                  color={isPrimary ? COLORS.primary : COLORS.subtext} 
                />
                <Text style={styles.toggleText}>Set as Default Farm Center</Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.cancelBtn]} 
                  onPress={() => setShowSaveModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.confirmBtn]} 
                  onPress={handleSaveFinal}
                >
                  <Text style={styles.confirmBtnText}>Confirm Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  primaryCard:    { borderColor: COLORS.primary, borderLeftWidth: 6 },
  zoneInfo:       { flex: 1 },
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  zoneTitle:      { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  primaryBadge:   { backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  primaryText:    { color: '#fff', fontSize: 10, fontWeight: '800' },
  zoneMeta:       { color: COLORS.subtext, fontSize: 12 },
  deleteBtn:      { padding: 8 },
  emptyText:      { color: COLORS.subtext, textAlign: 'center', marginTop: 40, fontSize: 14 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  modalTitle:   { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 24 },
  label:        { color: COLORS.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  input:        { height: 56, backgroundColor: COLORS.card, borderRadius: 16, paddingHorizontal: 16, color: COLORS.text, fontSize: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  row:          { flexDirection: 'row', gap: 12, marginBottom: 20 },
  pickerContainer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  typeBtn:      { flex: 1, height: 40, borderRadius: 10, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  activeType:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText:  { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 },
  toggleText:   { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn:     { flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtn:    { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  confirmBtn:   { backgroundColor: COLORS.primary },
  cancelBtnText: { color: COLORS.subtext, fontWeight: '600' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
});
