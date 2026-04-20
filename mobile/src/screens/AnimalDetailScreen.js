import React, { useState, useEffect, useCallback } from 'react';
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

  const [lastSyncDiff, setLastSyncDiff] = useState(0);

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

  const getBpmStatus = (bpm) => {
    if (!bpm || isSensorOffline) return { color: COLORS.textDim, label: 'No Data' };
    if (bpm > 120 || bpm < 40) return { color: COLORS.danger, label: 'Critique' };
    if (bpm > 100 || bpm < 50) return { color: COLORS.warning, label: 'Alerte' };
    return { color: COLORS.success, label: 'Stable' };
  };

  const bpmStatus = getBpmStatus(animal.heart_rate);
  const isSensorOffline = lastSyncDiff > 120; // 2 minute timeout for hardware sync
  const isStale = lastSyncDiff > 30; // 30s threshold for "stale" visual feedback
  
  const statusColor = isSensorOffline ? COLORS.status.offline 
                    : (COLORS.status[animal.status] || COLORS.status.safe);
  
  const typeInfo = ANIMAL_TYPES.find(t => t.id === animal.type) || ANIMAL_TYPES[5];
  const typeIcon = typeInfo.icon;

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
        </View>

        {!isEditing && (
          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              <MaterialCommunityIcons name={typeIcon} size={48} color={COLORS.white} />
            </View>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isSensorOffline ? COLORS.danger : COLORS.success }]} />
              <Text style={styles.statusText}>
                {(isSensorOffline ? 'SENSEUR DÉCONNECTÉ' : (animal.status || 'OK')).toUpperCase()}
              </Text>
            </View>
            {animal.last_sync && (
              <Text style={styles.syncTimer}>
                {isSensorOffline ? `Hors-ligne depuis ${Math.floor(lastSyncDiff/60)}m` : `Dernière sync: il y a ${lastSyncDiff}s`}
              </Text>
            )}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isEditing ? (
          <Formik
            initialValues={{
              name:     animal?.name     || '',
              type:     animal?.type     || 'cow',
              breed:    animal?.breed    || '',
              weightKg: animal?.weight_kg ? String(animal.weight_kg) : '',
              age:      animal?.birth_date ? String(Math.floor((new Date() - new Date(animal.birth_date)) / (1000*60*60*24*365))) : '',
              deviceId: animal?.device_id || '',
              currentZoneId: animal?.current_zone_id || '',
            }}
            validationSchema={AnimalSchema}
            onSubmit={handleSave}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldValue }) => (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nom de l'animal</Text>
                  <TextInput 
                    style={[styles.input, touched.name && errors.name && styles.inputError]}
                    value={values.name}
                    onChangeText={handleChange('name')}
                    placeholder="ex: Bessie"
                    placeholderTextColor={COLORS.textDim}
                  />
                  {touched.name && errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Type d'animal</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                    {ANIMAL_TYPES.map(t => (
                      <TouchableOpacity 
                        key={t.id} 
                        style={[styles.typeItem, values.type === t.id && styles.typeItemActive]}
                        onPress={() => setFieldValue('type', t.id)}
                      >
                        <MaterialCommunityIcons name={t.icon} size={24} color={values.type === t.id ? COLORS.white : COLORS.textDim} />
                        <Text style={[styles.typeLabel, values.type === t.id && styles.typeLabelActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Zone de la Ferme</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                    {geofences.map(gf => {
                      const gfId = String(gf.id || gf._id);
                      return (
                        <TouchableOpacity 
                          key={gfId} 
                          style={[styles.typeItem, values.currentZoneId === gfId && styles.typeItemActive]}
                          onPress={() => setFieldValue('currentZoneId', gfId)}
                        >
                          <Ionicons name="layers" size={20} color={values.currentZoneId === gfId ? COLORS.white : COLORS.textDim} />
                          <Text style={[styles.typeLabel, values.currentZoneId === gfId && styles.typeLabelActive]}>{gf.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Âge (Années)</Text>
                    <TextInput 
                      style={styles.input}
                      value={values.age}
                      onChangeText={handleChange('age')}
                      keyboardType="numeric"
                      placeholder="5"
                      placeholderTextColor={COLORS.textDim}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Poids (kg)</Text>
                    <TextInput 
                      style={styles.input}
                      value={values.weightKg}
                      onChangeText={handleChange('weightKg')}
                      keyboardType="numeric"
                      placeholder="450"
                      placeholderTextColor={COLORS.textDim}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ID Collier / Device IOT (Disponibles)</Text>
                  {freeDevices.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                      {freeDevices.map(device => (
                        <TouchableOpacity 
                          key={device.device_id} 
                          style={[styles.typeItem, values.deviceId === device.device_id && styles.typeItemActive]}
                          onPress={() => setFieldValue('deviceId', device.device_id)}
                        >
                          <MaterialCommunityIcons 
                            name="nfc-variant" 
                            size={20} 
                            color={values.deviceId === device.device_id ? COLORS.white : COLORS.textDim} 
                          />
                          <Text style={[styles.typeLabel, values.deviceId === device.device_id && styles.typeLabelActive]}>
                            {device.device_id}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyDeviceContainer}>
                      <TextInput 
                        style={[styles.input, touched.deviceId && errors.deviceId && styles.inputError]}
                        value={values.deviceId}
                        onChangeText={handleChange('deviceId')}
                        placeholder="Entrez ID Manuel"
                        placeholderTextColor={COLORS.textDim}
                      />
                      <Text style={styles.emptyDeviceText}>Aucun collier libre détecté. Saisie manuelle activée.</Text>
                    </View>
                  )}
                  {touched.deviceId && errors.deviceId && <Text style={styles.errorText}>{errors.deviceId}</Text>}
                </View>

                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={handleSubmit}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>{isCreate ? "Créer l'animal" : "Enregistrer les modifications"}</Text>}
                </TouchableOpacity>
              </View>
            )}
          </Formik>
        ) : (
          <View style={styles.dashboard}>
            {/* Actuators Control Card */}
            <Text style={styles.sectionTitle}>Commandes Hardware (Actuateurs)</Text>
            <View style={styles.actuatorCard}>
              <View style={styles.actuatorRow}>
                <View style={styles.actuatorLabelCol}>
                  <MaterialCommunityIcons name="alarm-bell" size={24} color={animal.actuators?.buzzer ? COLORS.danger : COLORS.textDim} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.actuatorName}>Alarme / Buzzer</Text>
                    <Text style={styles.actuatorSub}>{animal.actuators?.buzzer ? 'Activé' : 'Désactivé'}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.actuatorToggle, animal.actuators?.buzzer && styles.actuatorActive]}
                  onPress={() => handleAction('buzzer', animal.actuators?.buzzer)}
                >
                  <View style={[styles.toggleCircle, animal.actuators?.buzzer && styles.toggleCircleActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.actuatorRow}>
                <View style={styles.actuatorLabelCol}>
                  <MaterialCommunityIcons name="lightbulb-on" size={24} color={animal.actuators?.led ? COLORS.success : COLORS.textDim} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.actuatorName}>Indicateur LED</Text>
                    <Text style={styles.actuatorSub}>Signal Visuel Hardware</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.actuatorToggle, animal.actuators?.led && styles.actuatorActiveLed]}
                  onPress={() => handleAction('led', animal.actuators?.led)}
                >
                  <View style={[styles.toggleCircle, animal.actuators?.led && styles.toggleCircleActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.actuatorRow}>
                <View style={styles.actuatorLabelCol}>
                  <MaterialCommunityIcons name="electric-switch" size={24} color={animal.actuators?.relay ? COLORS.info : COLORS.textDim} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.actuatorName}>Relais de Sécurité</Text>
                    <Text style={styles.actuatorSub}>Clôture Électrique / Verrou</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.actuatorToggle, animal.actuators?.relay && styles.actuatorActiveRelay]}
                  onPress={() => handleAction('relay', animal.actuators?.relay)}
                >
                  <View style={[styles.toggleCircle, animal.actuators?.relay && styles.toggleCircleActive]} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Health Grid */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>État des Capteurs (Réel)</Text>
              {isStale && <View style={styles.staleBadge}><Text style={styles.staleBadgeText}>DATA STALE</Text></View>}
            </View>
            <View style={[styles.healthGrid, isStale && { opacity: 0.7 }]}>
              <HealthWidget 
                title="Cœur" 
                value={isSensorOffline ? '--' : (animal.heart_rate || '--')} 
                unit="BPM" 
                icon="heart" 
                color={bpmStatus.color} 
                pulse={!isSensorOffline && (animal.heart_rate > 100 || animal.heart_rate < 50)}
                subValue={isSensorOffline ? 'No Signal' : bpmStatus.label}
              />
              <HealthWidget 
                title="Température" 
                value={isSensorOffline ? '--' : (animal.temperature?.toFixed(1) || '--')} 
                unit="°C" 
                icon="thermometer" 
                color={COLORS.danger} 
                subValue={isSensorOffline ? 'Sync Lost' : 'Physiologique'}
              />
              <HealthWidget 
                title="Batterie IOT" 
                value={animal.battery_level || '--'} 
                unit="%" 
                icon={animal.battery_level < 20 ? 'battery-dead' : 'battery-charging'} 
                color={animal.battery_level < 20 ? COLORS.warning : COLORS.success} 
                subValue={animal.battery_level < 20 ? 'Action Requise' : 'Alimenté'}
              />
              <HealthWidget 
                title="Signal GSM" 
                value={animal.gps_signal || '--'} 
                unit="%" 
                icon="wifi" 
                color={animal.gps_signal < 40 ? COLORS.warning : COLORS.info} 
                subValue={animal.gps_signal < 40 ? 'Signal Faible' : 'Excellent'}
              />
            </View>

            {/* Daily Distance Section */}
            <View style={styles.distanceCard}>
              <View style={styles.distanceInfo}>
                <Text style={styles.distanceLabel}>Distance cumulée (GPS Réel)</Text>
                <Text style={styles.distanceValue}>-- <Text style={styles.distanceUnit}>km</Text></Text>
                <Text style={styles.distanceGoal}>Données basées sur les logs IoT</Text>
              </View>
              <View style={styles.distanceProgress}>
                <View style={[styles.progressBar, { width: '10%', backgroundColor: COLORS.primary }]} />
              </View>
            </View>

            {/* Info Section */}
            <Text style={styles.sectionTitle}>Maintenance Matérielle</Text>
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Ionicons name="finger-print" size={18} color={COLORS.textDim} />
                <Text style={styles.infoKey}>Hardware ID</Text>
                <Text style={styles.infoVal}>{animal.device_id || 'Non assigné'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="wifi" size={18} color={COLORS.textDim} />
                <Text style={styles.infoKey}>Force du Signal</Text>
                <Text style={styles.infoVal}>{animal.gps_signal ? `${animal.gps_signal}%` : 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={18} color={COLORS.textDim} />
                <Text style={styles.infoKey}>Dernière Sync Matérielle</Text>
                <Text style={styles.infoVal}>{animal.last_sync ? new Date(animal.last_sync).toLocaleTimeString() : 'Jamais'}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
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
