import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAnimalStore from '../store/animalStore';
import useGeofenceStore from '../store/geofenceStore';

const COLORS = {
  primary:    '#6366F1', 
  background: '#0F172A', 
  surface:    '#1E293B', 
  card:       '#1E2A45', 
  text:       '#F8FAFC', 
  subtext:    '#94A3B8', 
  danger:     '#EF4444', 
  safe:       '#10B981',
  border:     'rgba(255, 255, 255, 0.08)',
};

const TYPES = ['bovine', 'ovine', 'caprine', 'equine', 'other'];
const TYPE_ICONS = { bovine: 'cow', ovine: 'sheep', caprine: 'sheep', equine: 'horse-variant', other: 'paw' };

const AnimalSchema = Yup.object().shape({
  name:     Yup.string().required('Name is required'),
  type:     Yup.string().oneOf(TYPES).required(),
  age:      Yup.number().min(0).max(50).nullable(),
  weightKg: Yup.number().min(0).nullable(),
  deviceId: Yup.string().nullable(), // Optional mode
  rfidTag:  Yup.string().nullable(),
});

// ── UTILITY: Auto-Generate IDs ──
const generateHardwareId = (prefix) => {
  const ts = Math.floor(Date.now() / 1000).toString().slice(-6);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}_${ts}_${rand}`;
};

export default function AnimalDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { animal, mode, initialLocation, initialZoneId } = route.params || {};
  const isCreate = mode === 'create';
  const [saving, setSaving] = useState(false);
  
  const { createAnimal, updateAnimal, fetchAvailableDevices, availableDevices } = useAnimalStore();
  const { geofences, fetchGeofences } = useGeofenceStore();

  useEffect(() => {
    fetchGeofences();
    fetchAvailableDevices();
  }, []);

  const handleSave = async (values, { setFieldValue, submitForm }) => {
    console.log(`[AnimalDetail] Submitting ${mode} request:`, {
      name: values.name,
      device_id: values.deviceId,
      rfid_tag: values.rfidTag,
    });

    setSaving(true);
    try {
      if (isCreate) {
        await createAnimal(values);
      } else {
        await updateAnimal(animal.id, values);
      }
      
      Alert.alert('Success', `Animal ${isCreate ? 'registered' : 'updated'} successfully.`);
      navigation.goBack();
    } catch (err) {
      // ── DUPLICATE RESOLUTION FLOW ──
      if (err.message.includes('déjà utilisé') || err.message.includes('duplicate')) {
        Alert.alert(
          'Conflict Detected',
          `${err.message}\n\nWould you like to auto-generate a unique ID to continue?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Auto-Generate', 
              onPress: async () => {
                const newId = generateHardwareId('DEV');
                setFieldValue('deviceId', newId);
                // We don't submit immediately to let user see the new ID
                Alert.alert('ID Generated', `New ID: ${newId}. Press Save again to confirm.`);
              }
            }
          ]
        );
      } else {
        Alert.alert('Registration Conflict', err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isCreate ? 'Add New Animal' : 'Edit Animal'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Formik
          initialValues={{
            name:     animal?.name || '',
            type:     animal?.type || 'bovine',
            age:      animal?.age ? String(animal.age) : '',
            breed:    animal?.breed || '',
            weightKg: animal?.weight_kg ? String(animal.weight_kg) : '',
            deviceId: animal?.device_id || '',
            rfidTag:  animal?.rfid_tag || '',
            colorHex: animal?.color_hex || '#6366F1',
            currentZoneId: animal?.current_zone_id || initialZoneId || '',
            latitude:  animal?.latitude || initialLocation?.latitude || 0,
            longitude: animal?.longitude || initialLocation?.longitude || 0,
          }}
          validationSchema={AnimalSchema}
          onSubmit={handleSave}
        >
          {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldValue }) => (
            <View style={styles.form}>
              
              {/* SECTION: IDENTITY */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>identity</Text>
                
                <View style={styles.field}>
                  <Text style={styles.label}>Animal Name *</Text>
                  <TextInput 
                    style={[styles.input, touched.name && errors.name && styles.inputErr]}
                    placeholder="e.g. Luna"
                    placeholderTextColor={COLORS.subtext}
                    value={values.name}
                    onChangeText={handleChange('name')}
                    onBlur={handleBlur('name')}
                  />
                  {touched.name && errors.name && <Text style={styles.err}>{errors.name}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Species *</Text>
                  <View style={styles.typeGrid}>
                    {TYPES.map(t => (
                      <TouchableOpacity 
                        key={t}
                        style={[styles.typeBtn, values.type === t && styles.typeBtnActive]}
                        onPress={() => setFieldValue('type', t)}
                      >
                        <MaterialCommunityIcons 
                          name={TYPE_ICONS[t]} 
                          size={24} 
                          color={values.type === t ? '#fff' : COLORS.subtext} 
                        />
                        <Text style={[styles.typeBtnText, values.type === t && { color: '#fff' }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Age (Years)</Text>
                    <TextInput 
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="5"
                      placeholderTextColor={COLORS.subtext}
                      value={values.age}
                      onChangeText={handleChange('age')}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Weight (KG)</Text>
                    <TextInput 
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="450"
                      placeholderTextColor={COLORS.subtext}
                      value={values.weightKg}
                      onChangeText={handleChange('weightKg')}
                    />
                  </View>
                </View>
              </View>

              {/* SECTION: HARDWARE */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>tracking hardware</Text>
                
                <View style={styles.field}>
                  <Text style={styles.label}>Device / Collar ID (Optional)</Text>
                  
                  {/* Fleet Selection */}
                  <View style={styles.devicePickerContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                      {availableDevices.map(dev => (
                        <TouchableOpacity 
                          key={dev.device_id}
                          style={[styles.deviceBubble, values.deviceId === dev.device_id && styles.deviceBubbleActive]}
                          onPress={() => setFieldValue('deviceId', dev.device_id)}
                        >
                          <MaterialCommunityIcons 
                            name="watch" 
                            size={16} 
                            color={values.deviceId === dev.device_id ? '#fff' : COLORS.subtext} 
                          />
                          <Text style={[styles.deviceBubbleText, values.deviceId === dev.device_id && { color: '#fff' }]}>
                            {dev.device_id}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <Text style={[styles.label, { marginTop: 15 }]}>Or enter manually:</Text>
                  <TextInput 
                    style={[styles.input, touched.deviceId && errors.deviceId && styles.inputErr]}
                    placeholder="e.g. IOT_772"
                    placeholderTextColor={COLORS.subtext}
                    autoCapitalize="none"
                    value={values.deviceId}
                    onChangeText={handleChange('deviceId')}
                    onBlur={handleBlur('deviceId')}
                  />
                  {touched.deviceId && errors.deviceId && <Text style={styles.err}>{errors.deviceId}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>RFID Tag (Optional)</Text>
                  <TextInput 
                    style={styles.input}
                    placeholder="e.g. RFID_991"
                    placeholderTextColor={COLORS.subtext}
                    autoCapitalize="none"
                    value={values.rfidTag}
                    onChangeText={handleChange('rfidTag')}
                  />
                </View>
              </View>

              {/* SECTION: ZONE */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>zone assignment</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneScroll}>
                  {geofences.map(gf => (
                    <TouchableOpacity 
                      key={gf.id}
                      style={[styles.zoneCard, values.currentZoneId === gf.id && styles.zoneCardActive]}
                      onPress={() => setFieldValue('currentZoneId', gf.id)}
                    >
                      <View style={[styles.zoneIcon, { backgroundColor: gf.fill_color || COLORS.primary }]}>
                        <Ionicons name="map" size={18} color="#fff" />
                      </View>
                      <Text style={[styles.zoneName, values.currentZoneId === gf.id && { color: COLORS.primary }]}>{gf.name}</Text>
                      {values.currentZoneId === gf.id && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity 
                    style={[styles.zoneCard, values.currentZoneId === '' && styles.zoneCardActive]}
                    onPress={() => setFieldValue('currentZoneId', '')}
                  >
                    <View style={[styles.zoneIcon, { backgroundColor: COLORS.offline }]}>
                      <Ionicons name="ban" size={18} color="#fff" />
                    </View>
                    <Text style={styles.zoneName}>Unassigned</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* SAVE BUTTON */}
              <TouchableOpacity 
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark-sharp" size={24} color="#fff" />
                    <Text style={styles.saveBtnText}>{isCreate ? 'Create Animal' : 'Save Changes'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Formik>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: COLORS.surface },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900' },

  scroll: { paddingBottom: 60 },
  form: { padding: 20 },
  section: { marginBottom: 30 },
  sectionLabel: { color: COLORS.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 15 },
  
  field: { marginBottom: 18 },
  label: { color: COLORS.subtext, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: COLORS.surface, borderRadius: 16, height: 54, paddingHorizontal: 16, color: COLORS.text, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },
  inputErr: { borderColor: COLORS.danger },
  err: { color: COLORS.danger, fontSize: 12, marginTop: 5, fontWeight: '600' },
  
  row: { flexDirection: 'row', gap: 12 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: { width: (width - 60) / 3, height: 80, backgroundColor: COLORS.surface, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { color: COLORS.subtext, fontSize: 10, fontWeight: '800', marginTop: 6, textTransform: 'uppercase' },

  zoneScroll: { gap: 12, paddingRight: 40 },
  zoneCard: { width: 140, backgroundColor: COLORS.surface, borderRadius: 20, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  zoneCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '11' },
  zoneIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  zoneName: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginBottom: 5 },

  devicePickerContainer: { marginBottom: 10 },
  deviceBubble: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: COLORS.surface, paddingHorizontal: 15, paddingVertical: 10, 
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border 
  },
  deviceBubbleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  deviceBubbleText: { color: COLORS.subtext, fontSize: 13, fontWeight: '700', marginLeft: 8 },

  saveBtn: { height: 58, backgroundColor: COLORS.primary, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
