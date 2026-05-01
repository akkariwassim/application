import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import useGeofenceStore from '../store/geofenceStore';
import useAnimalStore   from '../store/animalStore';
import useThemeStore    from '../store/themeStore';
import { calculateCentroid, calculatePolygonArea } from '../utils/geoUtils';
import { SHADOWS } from '../config/theme';

export default function GeofenceScreen({ navigation, route }) {
  const { geofences, fetchGeofences, createGeofence, updateGeofence, deleteGeofence, isLoading } = useGeofenceStore();
  const { animals } = useAnimalStore();
  const { getColors, isDarkMode } = useThemeStore();
  const COLORS = getColors();
  const styles = createStyles(COLORS);
  
  const [editingId, setEditingId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newPolygon, setNewPolygon] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState('grazing');
  const [area, setArea] = useState(0);

  useEffect(() => {
    if (route.params?.editId) {
      const gf = geofences.find(g => g.id === route.params.editId);
      if (gf) {
        setEditingId(gf.id);
        const coords = typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
        setNewPolygon(coords);
        setIsDrawing(true);
        setZoneName(gf.name);
        setZoneType(gf.zone_type || 'grazing');
      }
    }
  }, [route.params?.editId]);

  const handleMapPress = (e) => {
    if (!isDrawing) return;
    setNewPolygon([...newPolygon, e.nativeEvent.coordinate]);
    setArea(calculatePolygonArea([...newPolygon, e.nativeEvent.coordinate]));
  };

  const handleSave = async () => {
    if (!zoneName.trim()) {
      Alert.alert('Erreur', 'Veuillez donner un nom à cette zone.');
      return;
    }
    
    try {
      const zoneData = {
        name: zoneName,
        polygon_coords: newPolygon,
        zone_type: zoneType,
        is_active: true
      };

      if (editingId) {
        await updateGeofence(editingId, zoneData);
      } else {
        await createGeofence(zoneData);
      }
      
      setShowSaveModal(false);
      setIsDrawing(false);
      setNewPolygon([]);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la zone.');
    }
  };

  const handleCancel = () => {
    setIsDrawing(false);
    setNewPolygon([]);
    setEditingId(null);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={setMapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType="hybrid"
        onPress={handleMapPress}
      >
        {geofences.map((gf) => {
          const coords = typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords;
          if (!coords || coords.length < 3) return null;
          return (
            <Polygon
              key={gf.id}
              coordinates={coords}
              strokeColor={COLORS.primary}
              fillColor={COLORS.primary + '30'}
              strokeWidth={2}
            />
          );
        })}

        {newPolygon.length > 0 && (
          <>
            <Polygon
              coordinates={newPolygon}
              strokeColor={COLORS.success}
              fillColor={COLORS.success + '40'}
              strokeWidth={3}
            />
            {newPolygon.map((p, i) => (
              <Marker key={i} coordinate={p} anchor={{x: 0.5, y: 0.5}}>
                <View style={styles.vertexMarker} />
              </Marker>
            ))}
          </>
        )}
      </MapView>

      <View style={styles.overlay}>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setIsDrawing(!isDrawing)}>
          <Ionicons name={isDrawing ? "close" : "brush-outline"} size={24} color={isDrawing ? COLORS.danger : COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => mapRef?.animateToRegion({ latitude: animals[0]?.latitude || 0, longitude: animals[0]?.longitude || 0, latitudeDelta: 0.005, longitudeDelta: 0.005 })}>
          <Ionicons name="navigate-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {isDrawing && (
        <View style={styles.bottomBar}>
          <View style={styles.barInfo}>
            <Text style={styles.barTitle}>Nouvelle Zone</Text>
            <Text style={styles.barSub}>{newPolygon.length} points · {(area/10000).toFixed(2)} ha</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.primaryBtn, newPolygon.length < 3 && { opacity: 0.5 }]} 
              onPress={() => setShowSaveModal(true)}
              disabled={newPolygon.length < 3}
            >
              <Text style={styles.primaryBtnText}>Continuer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={showSaveModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enregistrer la Zone</Text>
              <TouchableOpacity onPress={() => setShowSaveModal(false)}>
                <Ionicons name="close" size={28} color={COLORS.textDim} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Nom de la Zone</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Pâturage Nord"
              placeholderTextColor={COLORS.textDim}
              value={zoneName}
              onChangeText={setZoneName}
              autoFocus
            />

            <Text style={styles.label}>Type de Terrain</Text>
            <View style={styles.typeRow}>
              {['grazing', 'water', 'rest', 'danger'].map(t => (
                <TouchableOpacity 
                  key={t} 
                  style={[styles.typeChip, zoneType === t && styles.typeChipActive]}
                  onPress={() => setZoneType(t)}
                >
                  <Text style={[styles.typeChipText, zoneType === t && styles.typeChipTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveActionBtn} onPress={handleSave}>
              <Text style={styles.saveActionText}>Confirmer la Création</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { flex: 1 },
  overlay: { position: 'absolute', top: 60, right: 20, gap: 12 },
  toolBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', ...SHADOWS.hard, borderWidth: 1, borderColor: COLORS.border },
  
  vertexMarker: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.success },
  
  bottomBar: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: COLORS.surface, borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...SHADOWS.hard, borderWidth: 1, borderColor: COLORS.border },
  barInfo: { flex: 1 },
  barTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  barSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { color: COLORS.text, fontWeight: '700' },
  primaryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, ...SHADOWS.soft },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  
  modalBackdrop: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: COLORS.background, borderRadius: 14, height: 54, paddingHorizontal: 18, color: COLORS.text, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.background, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  typeChipTextActive: { color: COLORS.white },
  
  saveActionBtn: { backgroundColor: COLORS.primary, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...SHADOWS.hard },
  saveActionText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});
