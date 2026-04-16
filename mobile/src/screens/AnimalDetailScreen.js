import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import useAnimalStore from '../store/animalStore';
import useGeofenceStore from '../store/geofenceStore';

const COLORS = {
  primary:'#4F46E5', background:'#0A0F1E', surface:'#131929',
  card:'#1E2A45', text:'#F0F4FF', subtext:'#94A3B8',
  danger:'#EF4444', border:'rgba(255,255,255,0.08)', safe:'#22C55E',
};

const TYPES = ['bovine','ovine','caprine','equine','other'];
const TYPE_EMOJI = { bovine:'🐄', ovine:'🐑', caprine:'🐐', equine:'🐴', other:'🐾' };

const AnimalSchema = Yup.object().shape({
  name:     Yup.string().required('Name is required'),
  type:     Yup.string().oneOf(TYPES).required(),
  breed:    Yup.string().optional(),
  weightKg: Yup.number().min(0).optional().nullable(),
  deviceId: Yup.string().optional(),
  latitude: Yup.number().optional(),
  longitude: Yup.number().optional(),
});

export default function AnimalDetailScreen({ route, navigation }) {
  const { animal, mode, initialLocation, initialZoneId } = route.params || {};
  const isCreate   = mode === 'create';
  const [saving, setSaving] = useState(false);
  const { createAnimal, updateAnimal } = useAnimalStore();
  const { geofences, fetchGeofences } = useGeofenceStore();

  useEffect(() => {
    fetchGeofences();
  }, []);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (isCreate) {
        await createAnimal(values);
      } else {
        await updateAnimal(animal.id, values);
      }

      Alert.alert('Success', isCreate ? 'Animal created!' : 'Animal updated!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor:COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>{isCreate ? '🐄 Add Animal' : '✏️ Edit Animal'}</Text>

        <Formik
          initialValues={{
            name:     animal?.name     || '',
            type:     animal?.type     || 'bovine',
            breed:    animal?.breed    || '',
            weightKg: animal?.weight_kg ? String(animal.weight_kg) : '',
            deviceId: animal?.device_id || '',
            colorHex: animal?.color_hex || '#4CAF50',
            currentZoneId: animal?.current_zone_id || initialZoneId || '',
            latitude: animal?.latitude || initialLocation?.latitude || 0,
            longitude: animal?.longitude || initialLocation?.longitude || 0,
          }}
          validationSchema={AnimalSchema}
          onSubmit={handleSave}
        >
          {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldValue }) => (
            <>
              {/* Name */}
              <View style={styles.field}>
                <Text style={styles.label}>Name *</Text>
                <TextInput style={[styles.input, touched.name && errors.name && styles.inputErr]}
                  placeholder="e.g. Bessie" placeholderTextColor={COLORS.subtext}
                  value={values.name} onChangeText={handleChange('name')} onBlur={handleBlur('name')} />
                {touched.name && errors.name && <Text style={styles.err}>{errors.name}</Text>}
              </View>

              {/* Type Selector */}
              <View style={styles.field}>
                <Text style={styles.label}>Type *</Text>
                <View style={styles.typeRow}>
                  {TYPES.map((t) => (
                    <TouchableOpacity key={t}
                      style={[styles.typeBtn, values.type === t && styles.typeBtnActive]}
                      onPress={() => setFieldValue('type', t)}>
                      <Text style={styles.typeEmoji}>{TYPE_EMOJI[t]}</Text>
                      <Text style={[styles.typeText, values.type === t && { color: COLORS.primary }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Breed */}
              <View style={styles.field}>
                <Text style={styles.label}>Breed</Text>
                <TextInput style={styles.input} placeholder="e.g. Holstein"
                  placeholderTextColor={COLORS.subtext} value={values.breed}
                  onChangeText={handleChange('breed')} />
              </View>

              {/* Weight */}
              <View style={styles.field}>
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput style={styles.input} placeholder="e.g. 450"
                  placeholderTextColor={COLORS.subtext} keyboardType="numeric"
                  value={values.weightKg} onChangeText={handleChange('weightKg')} />
              </View>

              {/* Device ID */}
              <View style={styles.field}>
                <Text style={styles.label}>Device ID</Text>
                <TextInput style={styles.input} placeholder="e.g. ESP32_001"
                  placeholderTextColor={COLORS.subtext} autoCapitalize="none"
                  value={values.deviceId} onChangeText={handleChange('deviceId')} />
              </View>

              {/* Zone Placement */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🗺 Zone Assignment</Text>
              </View>
              
              <View style={styles.zoneList}>
                {geofences.length === 0 ? (
                  <Text style={styles.emptyZones}>No zones found. Create one in the Zones tab first.</Text>
                ) : (
                  geofences.map((gf) => (
                    <TouchableOpacity 
                      key={gf.id}
                      style={[
                        styles.zoneItem, 
                        values.currentZoneId === gf.id && styles.zoneItemActive
                      ]}
                      onPress={() => {
                        setFieldValue('currentZoneId', gf.id);
                        // If coordinates are missing or at 0,0, snap to zone center
                        const lat = parseFloat(values.latitude || 0);
                        const lon = parseFloat(values.longitude || 0);
                        if ((Math.abs(lat) < 0.001 && Math.abs(lon) < 0.001) && gf.center_lat && gf.center_lon) {
                          setFieldValue('latitude', gf.center_lat);
                          setFieldValue('longitude', gf.center_lon);
                        }
                      }}
                    >
                      <View style={[styles.zoneColor, { backgroundColor: gf.fill_color || COLORS.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.zoneName, values.currentZoneId === gf.id && { color: COLORS.primary }]}>
                          {gf.name}
                        </Text>
                        <Text style={styles.zoneType}>{gf.zone_type} · {(gf.area_sqm / 10000).toFixed(2)} Ha</Text>
                      </View>
                      {values.currentZoneId === gf.id && (
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
                
                {values.currentZoneId !== '' && (
                  <TouchableOpacity 
                    style={styles.clearZone} 
                    onPress={() => setFieldValue('currentZoneId', '')}
                  >
                    <Text style={styles.clearZoneText}>No Zone Assignment</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Save */}
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity:0.6 }]}
                onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>{isCreate ? 'Create Animal' : 'Save Changes'}</Text>}
              </TouchableOpacity>
            </>
          )}
        </Formik>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:        { padding:20, paddingBottom:60 },
  heading:       { fontSize:22, fontWeight:'800', color:COLORS.text, marginBottom:24 },
  field:         { marginBottom:16 },
  label:         { color:COLORS.subtext, fontSize:13, fontWeight:'600', marginBottom:6 },
  input:         { backgroundColor:COLORS.surface, borderRadius:12, borderWidth:1, borderColor:COLORS.border, height:48, paddingHorizontal:14, color:COLORS.text, fontSize:15 },
  inputErr:      { borderColor:COLORS.danger },
  err:           { color:COLORS.danger, fontSize:12, marginTop:4 },
  typeRow:       { flexDirection:'row', flexWrap:'wrap', gap:8 },
  typeBtn:       { alignItems:'center', paddingHorizontal:12, paddingVertical:8, borderRadius:12, borderWidth:1, borderColor:COLORS.border, backgroundColor:COLORS.surface },
  typeBtnActive: { borderColor:COLORS.primary, backgroundColor:COLORS.primary+'22' },
  typeEmoji:     { fontSize:22 },
  typeText:      { color:COLORS.subtext, fontSize:11, marginTop:2, textTransform:'capitalize' },
  sectionHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12, marginTop:8 },
  sectionTitle:  { color:COLORS.text, fontSize:16, fontWeight:'700' },
  toggle:        { paddingHorizontal:12, paddingVertical:5, borderRadius:10, borderWidth:1, borderColor:COLORS.border },
  toggleActive:  { borderColor:COLORS.primary, backgroundColor:COLORS.primary+'22' },
  toggleText:    { color:COLORS.subtext, fontSize:12, fontWeight:'600' },
  zoneList:      { marginBottom: 20 },
  zoneItem:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  zoneItemActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '11' },
  zoneColor:     { width: 4, height: 32, borderRadius: 2 },
  zoneName:      { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  zoneType:      { color: COLORS.subtext, fontSize: 11 },
  emptyZones:    { color: COLORS.subtext, textAlign: 'center', padding: 20, fontStyle: 'italic' },
  clearZone:     { alignItems: 'center', paddingVertical: 10 },
  clearZoneText: { color: COLORS.danger, fontSize: 13, fontWeight: '600' },
  saveBtn:       { backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText:   { color:'#fff', fontSize: 16, fontWeight:'700' },
});
