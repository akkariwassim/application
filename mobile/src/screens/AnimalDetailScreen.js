import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAnimalStore from '../store/animalStore';
import useGeofenceStore from '../store/geofenceStore';

const { width } = Dimensions.get('window');

const COLORS = {
  primary:    '#6366F1', 
  background: '#0F172A', 
  surface:    '#1E293B', 
  card:       '#1E2A45', 
  text:       '#F8FAFC', 
  subtext:    '#94A3B8', 
  danger:     '#EF4444', 
  safe:       '#10B981',
  success:    '#10B981',
  warning:    '#F59E0B',
  info:       '#6366F1',
  border:     'rgba(255, 255, 255, 0.08)',
  textDim:    '#94A3B8',
  white:      '#FFFFFF',
  offline:    '#64748B',
  status: {
    safe:    '#10B981',
    warning: '#F59E0B',
    danger:  '#EF4444',
    offline: '#64748B',
  }
};

const ANIMAL_TYPES = [
  { id: 'bovine', label: 'Bovin', icon: 'cow' },
  { id: 'ovine', label: 'Ovin', icon: 'sheep' },
  { id: 'caprine', label: 'Caprin', icon: 'sheep' },
  { id: 'equine', label: 'Équin', icon: 'horse-variant' },
  { id: 'other', label: 'Autre', icon: 'paw' }
];

const TYPES = ['bovine', 'ovine', 'caprine', 'equine', 'other'];
const TYPE_ICONS = { bovine: 'cow', ovine: 'sheep', caprine: 'sheep', equine: 'horse-variant', other: 'paw' };

const AnimalSchema = Yup.object().shape({
  name:     Yup.string().required('Nom requis'),
  type:     Yup.string().oneOf(TYPES).required(),
  age:      Yup.number().min(0).max(50).nullable(),
  weightKg: Yup.number().min(0).nullable(),
  deviceId: Yup.string().nullable(),
  rfidTag:  Yup.string().nullable(),
});

// ── UTILITY: Health Widget ──
const HealthWidget = ({ title, value, unit, icon, color, subValue, pulse }) => (
  <View style={styles.healthWidget}>
    <View style={[styles.healthIcon, { backgroundColor: color + '22' }]}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      {pulse && <View style={[styles.pulse, { backgroundColor: color }]} />}
    </View>
    <View style={styles.healthInfo}>
      <Text style={styles.healthTitle}>{title}</Text>
      <View style={styles.healthValueRow}>
        <Text style={styles.healthValue}>{value}</Text>
        <Text style={styles.healthUnit}>{unit}</Text>
      </View>
      <Text style={[styles.healthSub, { color }]}>{subValue}</Text>
    </View>
  </View>
);

export default function AnimalDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { animal: initialAnimal, mode, initialLocation, initialZoneId } = route.params || {};
  const isCreate = mode === 'create';
  
  const [isEditing, setIsEditing] = useState(isCreate);
  const [saving, setSaving] = useState(false);
  const [animal, setAnimal] = useState(initialAnimal || {});
  const [lastSyncDiff, setLastSyncDiff] = useState(0);
  
  const { createAnimal, updateAnimal, fetchAvailableDevices, availableDevices, animals } = useAnimalStore();
  const { geofences, fetchGeofences } = useGeofenceStore();

  // Sync with store if animal changes
  useEffect(() => {
    if (!isCreate && initialAnimal?.id) {
      const updated = animals.find(a => a.id === initialAnimal.id);
      if (updated) setAnimal(updated);
    }
  }, [animals, initialAnimal?.id, isCreate]);

  useEffect(() => {
    fetchGeofences();
    fetchAvailableDevices();

    const timer = setInterval(() => {
      if (animal?.last_sync) {
        const diff = Math.floor((Date.now() - new Date(animal.last_sync).getTime()) / 1000);
        setLastSyncDiff(Math.max(0, diff));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [animal?.last_sync]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (isCreate) {
        await createAnimal(values);
      } else {
        await updateAnimal(animal.id, values);
      }
      Alert.alert('Succès', `Animal ${isCreate ? 'enregistré' : 'mis à jour'} avec succès.`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action, currentState) => {
    // This calls the triggerAction from animalStore (indirectly via device integration)
    Alert.alert('Commande Hardware', `Envoi de la commande ${action}...`);
    // Logic for triggering buzzer/led/relay via backend
    const { triggerAction } = useAnimalStore.getState();
    await triggerAction(animal.id, action, !currentState);
  };

  const isSensorOffline = lastSyncDiff > 120;
  const isStale = lastSyncDiff > 30;
  
  const bpmStatus = (() => {
    const bpm = animal?.heart_rate;
    if (!bpm || isSensorOffline) return { color: COLORS.textDim, label: 'N/A' };
    if (bpm > 120 || bpm < 40) return { color: COLORS.danger, label: 'Critique' };
    if (bpm > 100 || bpm < 50) return { color: COLORS.warning, label: 'Alerte' };
    return { color: COLORS.success, label: 'Stable' };
  })();

  const typeIcon = TYPE_ICONS[animal.type || 'bovine'] || 'paw';

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isCreate ? 'Nouvel Animal' : (isEditing ? 'Éditer' : animal.name)}
        </Text>
        {!isCreate && (
          <TouchableOpacity 
            style={[styles.editBtn, isEditing && { backgroundColor: COLORS.primary }]} 
            onPress={() => setIsEditing(!isEditing)}
          >
            <Ionicons name={isEditing ? "eye" : "create"} size={20} color={COLORS.text} />
          </TouchableOpacity>
        )}
        {isCreate && <View style={{ width: 44 }} />}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isEditing ? (
          <Formik
            initialValues={{
              name:     animal?.name || '',
              type:     animal?.type || 'bovine',
              age:      animal?.age ? String(animal.age) : '',
              breed:    animal?.breed || '',
              weightKg: animal?.weight_kg ? String(animal.weight_kg) : '',
              deviceId: animal?.device_id || '',
              rfidTag:  animal?.rfid_tag || '',
              currentZoneId: animal?.current_zone_id || initialZoneId || '',
            }}
            validationSchema={AnimalSchema}
            onSubmit={handleSave}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldValue }) => (
              <View style={styles.form}>
                
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Identité</Text>
                  <View style={styles.field}>
                    <Text style={styles.label}>Nom de l'animal *</Text>
                    <TextInput 
                      style={[styles.input, touched.name && errors.name && styles.inputErr]}
                      value={values.name}
                      onChangeText={handleChange('name')}
                      onBlur={handleBlur('name')}
                      placeholder="ex: Luna"
                      placeholderTextColor={COLORS.subtext}
                    />
                    {touched.name && errors.name && <Text style={styles.err}>{errors.name}</Text>}
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Espèce *</Text>
                    <View style={styles.typeGrid}>
                      {ANIMAL_TYPES.map(t => (
                        <TouchableOpacity 
                          key={t.id}
                          style={[styles.typeBtn, values.type === t.id && styles.typeBtnActive]}
                          onPress={() => setFieldValue('type', t.id)}
                        >
                          <MaterialCommunityIcons 
                            name={t.icon} 
                            size={24} 
                            color={values.type === t.id ? COLORS.white : COLORS.subtext} 
                          />
                          <Text style={[styles.typeBtnText, values.type === t.id && { color: COLORS.white }]}>{t.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Hardware & Zone</Text>
                  
                  <View style={styles.field}>
                    <Text style={styles.label}>ID Collier / Device</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      {availableDevices.map(dev => (
                        <TouchableOpacity 
                          key={dev.device_id}
                          style={[styles.deviceBubble, values.deviceId === dev.device_id && styles.deviceBubbleActive]}
                          onPress={() => setFieldValue('deviceId', dev.device_id)}
                        >
                          <Text style={[styles.deviceBubbleText, values.deviceId === dev.device_id && { color: '#fff' }]}>
                            {dev.device_id}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TextInput 
                      style={styles.input}
                      value={values.deviceId}
                      onChangeText={handleChange('deviceId')}
                      placeholder="Saisie manuelle..."
                      placeholderTextColor={COLORS.subtext}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Zone Assignée</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {geofences.map(gf => (
                        <TouchableOpacity 
                          key={gf.id}
                          style={[styles.zoneCard, values.currentZoneId === gf.id && styles.zoneCardActive]}
                          onPress={() => setFieldValue('currentZoneId', gf.id)}
                        >
                          <Text style={[styles.zoneName, values.currentZoneId === gf.id && { color: COLORS.primary }]}>{gf.name}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity 
                        style={[styles.zoneCard, !values.currentZoneId && styles.zoneCardActive]}
                        onPress={() => setFieldValue('currentZoneId', '')}
                      >
                        <Text style={styles.zoneName}>Aucune</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{isCreate ? 'Créer' : 'Enregistrer'}</Text>}
                </TouchableOpacity>
              </View>
            )}
          </Formik>
        ) : (
          <View style={styles.dashboard}>
            {/* Header Mini Dashboard */}
            <View style={styles.headerInfo}>
              <View style={styles.avatarLarge}>
                <MaterialCommunityIcons name={typeIcon} size={60} color={COLORS.white} />
              </View>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: isSensorOffline ? COLORS.danger : COLORS.success }]} />
                <Text style={styles.statusText}>
                  {isSensorOffline ? 'HORS-LIGNE' : 'CONNECTÉ'}
                </Text>
              </View>
              {animal.last_sync && <Text style={styles.lastSync}>Sync: il y a {lastSyncDiff}s</Text>}
            </View>

            {/* Health Grid */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Signes Vitaux</Text>
              {isStale && <View style={styles.staleTag}><Text style={styles.staleTagText}>STALE</Text></View>}
            </View>
            <View style={styles.healthGrid}>
              <HealthWidget 
                title="Cœur" value={isSensorOffline ? '--' : (animal.heart_rate || '--')} unit="BPM" 
                icon="heart" color={bpmStatus.color} subValue={bpmStatus.label} pulse={!isSensorOffline}
              />
              <HealthWidget 
                title="Temp" value={isSensorOffline ? '--' : (typeof animal.temperature === 'number' ? animal.temperature.toFixed(1) : '--')} unit="°C" 
                icon="thermometer" color={COLORS.danger} subValue="Stable"
              />
              <HealthWidget 
                title="Batterie" value={animal.battery_level || '--'} unit="%" 
                icon="battery" color={COLORS.success} subValue="Correct"
              />
              <HealthWidget 
                title="Signal" value={animal.gps_signal || '--'} unit="%" 
                icon="wifi" color={COLORS.info} subValue="Excellent"
              />
            </View>

            {/* Hardware Controls */}
            <Text style={styles.sectionTitle}>Commandes Hardware</Text>
            <View style={styles.actuatorCard}>
              <ActuatorRow 
                name="Buzzer" icon="volume-high" 
                active={animal.actuators?.buzzer} 
                onToggle={() => handleAction('buzzer', animal.actuators?.buzzer)} 
              />
              <ActuatorRow 
                name="LED" icon="lightbulb" 
                active={animal.actuators?.led} 
                onToggle={() => handleAction('led', animal.actuators?.led)} 
              />
              <ActuatorRow 
                name="Relais" icon="power" 
                active={animal.actuators?.relay} 
                onToggle={() => handleAction('relay', animal.actuators?.relay)} 
              />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ActuatorRow = ({ name, icon, active, onToggle }) => (
  <View style={styles.actuatorRow}>
    <View style={styles.actuatorLabel}>
      <MaterialCommunityIcons name={icon} size={24} color={active ? COLORS.primary : COLORS.subtext} />
      <Text style={styles.actuatorText}>{name}</Text>
    </View>
    <TouchableOpacity 
      style={[styles.toggle, active && styles.toggleActive]} 
      onPress={onToggle}
    >
      <View style={[styles.toggleCircle, active && styles.toggleCircleActive]} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: COLORS.surface },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  editBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },

  scroll: { paddingBottom: 40 },
  form: { padding: 20 },
  section: { marginBottom: 25 },
  sectionLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 15 },
  field: { marginBottom: 15 },
  label: { color: COLORS.subtext, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: COLORS.surface, borderRadius: 12, height: 50, paddingHorizontal: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  inputErr: { borderColor: COLORS.danger },
  err: { color: COLORS.danger, fontSize: 12, marginTop: 4 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { width: (width - 60) / 3, height: 70, backgroundColor: COLORS.surface, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { color: COLORS.subtext, fontSize: 11, fontWeight: '700', marginTop: 4 },

  deviceBubble: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surface, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  deviceBubbleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  deviceBubbleText: { color: COLORS.subtext, fontSize: 12, fontWeight: '600' },

  zoneCard: { padding: 12, backgroundColor: COLORS.surface, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  zoneCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '11' },
  zoneName: { color: COLORS.text, fontSize: 13, fontWeight: '600' },

  saveBtn: { height: 55, backgroundColor: COLORS.primary, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  dashboard: { padding: 20 },
  headerInfo: { alignItems: 'center', marginBottom: 30 },
  avatarLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: COLORS.primary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  lastSync: { color: COLORS.subtext, fontSize: 12, marginTop: 8 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 15, marginTop: 10 },
  staleTag: { backgroundColor: COLORS.danger + '22', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  staleTagText: { color: COLORS.danger, fontSize: 10, fontWeight: '900' },

  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 25 },
  healthWidget: { width: (width - 52) / 2, backgroundColor: COLORS.surface, borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center' },
  healthIcon: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  healthInfo: { flex: 1 },
  healthTitle: { color: COLORS.subtext, fontSize: 11, fontWeight: '600' },
  healthValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  healthValue: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  healthUnit: { color: COLORS.subtext, fontSize: 10, marginLeft: 2 },
  healthSub: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  actuatorCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 15, marginBottom: 25 },
  actuatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  actuatorLabel: { flexDirection: 'row', alignItems: 'center' },
  actuatorText: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginLeft: 12 },
  toggle: { width: 50, height: 28, borderRadius: 15, backgroundColor: COLORS.background, padding: 3, justifyContent: 'center' },
  toggleActive: { backgroundColor: COLORS.primary },
  toggleCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.subtext },
  toggleCircleActive: { backgroundColor: COLORS.white, alignSelf: 'flex-end' },

  pulse: { position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4 },
});
