import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Animated, StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import useAnimalStore from '../store/animalStore';
import useGeofenceStore from '../store/geofenceStore';
import theme, { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../config/theme';
import HealthWidget from '../components/HealthWidget';

const AnimalSchema = Yup.object().shape({
  name:     Yup.string().required('Nom requis'),
  type:     Yup.string().oneOf(['cow','sheep','goat','camel','horse','other']).required(),
  breed:    Yup.string().optional(),
  weightKg: Yup.number().min(0).optional().nullable(),
  age:      Yup.number().min(0).optional().nullable(),
  deviceId: Yup.string().required('ID Collar requis'),
  currentZoneId: Yup.string().optional(),
});

const ANIMAL_TYPES = [
  { id: 'cow',   label: 'Vache', icon: 'cow' },
  { id: 'sheep', label: 'Mouton', icon: 'sheep' },
  { id: 'goat',  label: 'Chèvre', icon: 'paw' },
  { id: 'camel', label: 'Chameau', icon: 'paw' },
  { id: 'horse', label: 'Cheval', icon: 'horse-variant' },
  { id: 'other', label: 'Autre', icon: 'dots-horizontal' },
];

export default function AnimalDetailScreen({ route, navigation }) {
  const { animal: initialAnimal, mode } = route.params || {};
  const isCreate = mode === 'create';
  
  const [isEditing, setIsEditing] = useState(isCreate);
  const [saving, setSaving] = useState(false);
  const [animal, setAnimal] = useState(initialAnimal || {});

  const { createAnimal, updateAnimal, fetchAnimal, triggerAction, fetchFreeDevices, freeDevices } = useAnimalStore();
  const { geofences, fetchGeofences } = useGeofenceStore();

  const [lastSyncDiff, setLastSyncDiff] = useState(0);

  useEffect(() => {
    fetchGeofences();
    fetchFreeDevices(); // Load available hardware
    if (!isCreate && animal.id) {
      refreshData();
    }
  }, []);

  // Update "last sync" timer every second & Auto-refresh on focus
  useEffect(() => {
    const timer = setInterval(() => {
      if (animal.last_sync) {
        const diff = Math.floor((new Date() - new Date(animal.last_sync)) / 1000);
        setLastSyncDiff(diff);
        
        // Auto-refresh biometric data if focused and stale (> 10s)
        if (diff > 10 && !isEditing && !saving) {
            refreshData();
        }
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [animal.last_sync, isEditing, saving]);

  const refreshData = async () => {
    const updated = await fetchAnimal(animal.id);
    if (updated) setAnimal(updated);
  };

  const handleAction = async (type, currentState) => {
    try {
      const newState = !currentState;
      await triggerAction(animal.id, type, newState);
      setAnimal(prev => ({
        ...prev,
        actuators: { ...prev.actuators, [type]: newState }
      }));
    } catch (err) {
      Alert.alert('Erreur Hardware', err.message);
    }
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      // Professional Data Mapping (UI -> API)
      const payload = {
        ...values,
        weightKg: values.weightKg ? Number(values.weightKg) : null,
        birthDate: values.age ? new Date(new Date().setFullYear(new Date().getFullYear() - Number(values.age))).toISOString() : null,
        deviceId:  values.deviceId?.trim(),
        currentZoneId: values.currentZoneId || null,
      };

      if (isCreate) {
        await createAnimal(payload);
        Alert.alert('Succès ✅', "L'animal a été enregistré avec son équipement IoT.");
        
        // Dynamic Inventory Refresh
        fetchFreeDevices(); 
        
        // Auto Reset & Close (Professional UX)
        navigation.goBack();
      } else {
        const updated = await updateAnimal(animal.id, payload);
        setAnimal(updated);
        setIsEditing(false);
        Alert.alert('Mis à jour', 'Les modifications ont été synchronisées.');
      }
    } catch (err) {
      // Professional Conflict Handling (409)
      if (err.message.includes('409') || err.message.includes('DUPLICATE_DEVICE')) {
        Alert.alert(
          '⚠️ Conflit Matériel', 
          "Ce collier ou cet identifiant est déjà assigné à un autre animal sur la ferme. Veuillez choisir un autre équipement disponible."
        );
      } else {
        Alert.alert('Erreur Système', err.message);
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header Area */}
      <View style={[styles.header, { backgroundColor: statusColor }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.IconButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isCreate ? 'Nouvel Animal' : animal.name}</Text>
          {!isCreate && (
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.IconButton}>
              <Ionicons name={isEditing ? 'close' : 'create-outline'} size={24} color={COLORS.white} />
            </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  IconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  headerContent: { alignItems: 'center', marginTop: SPACING.lg },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { color: COLORS.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  
  scroll: { paddingBottom: 100 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: SPACING.lg },
  sectionTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800', marginLeft: SPACING.lg, marginTop: SPACING.xl, marginBottom: SPACING.md },
  staleBadge: { backgroundColor: COLORS.warning + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 10 },
  staleBadgeText: { color: COLORS.warning, fontSize: 9, fontWeight: '900' },
  
  // Dashboard
  dashboard: { paddingHorizontal: SPACING.md },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'space-between' },
  distanceCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft },
  distanceLabel: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  distanceValue: { color: COLORS.white, fontSize: 32, fontWeight: '800', marginVertical: 8 },
  distanceUnit: { fontSize: 16, color: COLORS.textDim },
  distanceGoal: { color: COLORS.textDim, fontSize: 11 },
  distanceProgress: { height: 6, backgroundColor: COLORS.divider, borderRadius: 3, marginTop: SPACING.md, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },
  
  infoList: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  infoKey: { color: COLORS.textMuted, fontSize: 14, flex: 1, marginLeft: 12 },
  infoVal: { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  // Form
  form: { padding: SPACING.lg },
  inputGroup: { marginBottom: SPACING.lg },
  inputRow: { flexDirection: 'row', gap: SPACING.md },
  inputLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, height: 52, paddingHorizontal: 16, color: COLORS.white, fontSize: 15, borderWidth: 1, borderColor: COLORS.border },
  inputError: { borderColor: COLORS.danger },
  saveBtn: { height: 56, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg, ...SHADOWS.hard },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },

  // Actuators
  actuatorCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft },
  actuatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  actuatorLabelCol: { flexDirection: 'row', alignItems: 'center' },
  actuatorName: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  actuatorSub: { color: COLORS.textDim, fontSize: 11 },
  actuatorToggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: COLORS.divider, padding: 2, justifyContent: 'center' },
  actuatorActive: { backgroundColor: COLORS.danger },
  actuatorActiveLed: { backgroundColor: COLORS.success },
  actuatorActiveRelay: { backgroundColor: COLORS.info },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white },
  toggleCircleActive: { alignSelf: 'flex-end' },
  divider: { height: 1, backgroundColor: COLORS.divider, marginHorizontal: -SPACING.md },
  syncTimer: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 8 },

  errorText: { color: COLORS.danger, fontSize: 10, marginTop: 4, marginLeft: 4, fontWeight: '600' },
  
  // Custom Selector
  typeSelector: { flexDirection: 'row', marginBottom: 4 },
  typeItem: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: COLORS.card, 
    borderRadius: 16, 
    padding: 12, 
    marginRight: 10, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    minWidth: 80
  },
  typeItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: '700', marginTop: 6 },
  typeLabelActive: { color: COLORS.white },

  emptyDeviceContainer: { marginTop: 4 },
  emptyDeviceText: { color: COLORS.textMuted, fontSize: 10, marginTop: 4, fontStyle: 'italic' },
});
