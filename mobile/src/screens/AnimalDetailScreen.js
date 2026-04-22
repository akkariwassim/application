import React, { useState, useEffect } from 'react';
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
  border:     'rgba(255, 255, 255, 0.08)',
};

const TYPES = ['bovine', 'ovine', 'caprine', 'equine', 'other'];
const TYPE_ICONS = { bovine: 'cow', ovine: 'sheep', caprine: 'sheep', equine: 'horse-variant', other: 'paw' };

const AnimalSchema = Yup.object().shape({
  name:     Yup.string().required('Name is required'),
  type:     Yup.string().oneOf(TYPES).required(),
  age:      Yup.number().min(0).max(50).nullable(),
  weightKg: Yup.number().min(0).nullable(),
  deviceId: Yup.string().nullable(),
  rfidTag:  Yup.string().nullable(),
});

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
  const [isEditing, setIsEditing] = useState(isCreate);
  const [lastSyncDiff, setLastSyncDiff] = useState(0);

  const { createAnimal, updateAnimal, fetchAvailableDevices, availableDevices } = useAnimalStore();
  const { geofences, fetchGeofences } = useGeofenceStore();

  useEffect(() => {
    fetchGeofences();
    fetchAvailableDevices();

    if (animal && animal.last_sync) {
      const diff = Math.floor((new Date() - new Date(animal.last_sync)) / 1000);
      setLastSyncDiff(diff);
    }
  }, [animal]);

  const handleSave = async (values, { setFieldValue }) => {
    setSaving(true);
    try {
      if (isCreate) {
        await createAnimal(values);
      } else {
        await updateAnimal(animal.id || animal._id, values);
      }
      Alert.alert('Succès', `Animal ${isCreate ? 'enregistré' : 'mis à jour'} avec succès.`);
      navigation.goBack();
    } catch (err) {
      if (err.message.includes('déjà utilisé') || err.message.includes('duplicate')) {
        Alert.alert(
          'Conflit de matériel',
          `${err.message}\n\nVoulez-vous générer un ID unique automatiquement ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            { 
              text: 'Générer', 
              onPress: () => {
                const newId = generateHardwareId('DEV');
                setFieldValue('deviceId', newId);
                Alert.alert('ID Généré', `Nouvel ID : ${newId}. Appuyez sur Sauvegarder pour confirmer.`);
              }
            }
          ]
        );
      } else {
        Alert.alert('Erreur', err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (type, currentState) => {
    try {
      await useAnimalStore.getState().triggerAction(animal.id || animal._id, type, !currentState);
    } catch (err) {
      Alert.alert('Erreur Hardware', err.message);
    }
  };

  const isSensorOffline = lastSyncDiff > 120;
  const isStale = lastSyncDiff > 30;

  const getBpmStatus = (bpm) => {
    if (!bpm || isSensorOffline) return { color: COLORS.subtext, label: 'Pas de données' };
    if (bpm > 110 || bpm < 45) return { color: COLORS.danger, label: 'Critique' };
    if (bpm > 95 || bpm < 55) return { color: COLORS.warning, label: 'Alerte' };
    return { color: COLORS.safe, label: 'Normal' };
  };

  const bpmStatus = getBpmStatus(animal?.heart_rate);

  const HealthWidget = ({ title, value, unit, icon, color, subValue }) => (
    <View style={styles.healthCard}>
      <View style={styles.healthHeader}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
        <Text style={styles.healthTitle}>{title}</Text>
      </View>
      <View style={styles.healthBody}>
        <Text style={[styles.healthValue, { color }]}>{value}</Text>
        <Text style={styles.healthUnit}>{unit}</Text>
      </View>
      <Text style={styles.healthSub}>{subValue}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isCreate ? 'Nouvel Animal' : isEditing ? 'Modifier Profil' : animal?.name}
        </Text>
        {!isCreate && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? "eye" : "create"} size={22} color={COLORS.primary} />
          </TouchableOpacity>
        )}
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
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Identité</Text>
                  <View style={styles.field}>
                    <Text style={styles.label}>Nom de l'animal *</Text>
                    <TextInput 
                      style={[styles.input, touched.name && errors.name && styles.inputErr]}
                      placeholder="ex: Luna"
                      placeholderTextColor={COLORS.subtext}
                      value={values.name}
                      onChangeText={handleChange('name')}
                      onBlur={handleBlur('name')}
                    />
                    {touched.name && errors.name && <Text style={styles.err}>{errors.name}</Text>}
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Espèce *</Text>
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
                      <Text style={styles.label}>Âge (Années)</Text>
                      <TextInput 
                        style={styles.input}
                        keyboardType="numeric"
                        value={values.age}
                        onChangeText={handleChange('age')}
                      />
                    </View>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>Poids (KG)</Text>
                      <TextInput 
                        style={styles.input}
                        keyboardType="numeric"
                        value={values.weightKg}
                        onChangeText={handleChange('weightKg')}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Matériel IOT</Text>
                  <View style={styles.field}>
                    <Text style={styles.label}>ID Collier / Device (Libres)</Text>
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
                    <TextInput 
                      style={[styles.input, { marginTop: 12 }]}
                      placeholder="Ou ID manuel"
                      placeholderTextColor={COLORS.subtext}
                      value={values.deviceId}
                      onChangeText={handleChange('deviceId')}
                    />
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Affectation Zone</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneScroll}>
                    {geofences.map(gf => (
                      <TouchableOpacity 
                        key={gf.id || gf._id}
                        style={[styles.zoneCard, values.currentZoneId === (gf.id || gf._id) && styles.zoneCardActive]}
                        onPress={() => setFieldValue('currentZoneId', gf.id || gf._id)}
                      >
                        <View style={[styles.zoneIcon, { backgroundColor: gf.fill_color || COLORS.primary }]}>
                          <Ionicons name="map" size={18} color="#fff" />
                        </View>
                        <Text style={styles.zoneName} numberOfLines={1}>{gf.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <TouchableOpacity 
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.saveBtnText}>{isCreate ? 'Créer Animal' : 'Enregistrer'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Formik>
        ) : (
          <View style={styles.dashboard}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Commandes à distance</Text>
              <View style={styles.actuatorRow}>
                <View style={styles.actuatorInfo}>
                  <MaterialCommunityIcons name="alarm-bell" size={24} color={animal?.actuators?.buzzer ? COLORS.danger : COLORS.subtext} />
                  <Text style={styles.actuatorName}>Buzzer / Alarme</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.toggle, animal?.actuators?.buzzer && styles.toggleActive]}
                  onPress={() => handleAction('buzzer', animal?.actuators?.buzzer)}
                >
                  <View style={[styles.toggleCircle, animal?.actuators?.buzzer && styles.toggleCircleActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.actuatorRow}>
                <View style={styles.actuatorInfo}>
                  <MaterialCommunityIcons name="lightbulb-on" size={24} color={animal?.actuators?.led ? COLORS.safe : COLORS.subtext} />
                  <Text style={styles.actuatorName}>Flash LED</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.toggle, animal?.actuators?.led && styles.toggleActive]}
                  onPress={() => handleAction('led', animal?.actuators?.led)}
                >
                  <View style={[styles.toggleCircle, animal?.actuators?.led && styles.toggleCircleActive]} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.gridHeader}>
              <Text style={styles.cardTitle}>Biométrie en temps réel</Text>
              {isStale && <Text style={styles.staleText}>DONNÉES ANCIENNES</Text>}
            </View>
            
            <View style={styles.healthGrid}>
              <HealthWidget 
                title="Cœur" 
                value={isSensorOffline ? '--' : animal?.heart_rate || '--'} 
                unit="BPM" 
                icon="heart" 
                color={bpmStatus.color} 
                subValue={bpmStatus.label}
              />
              <HealthWidget 
                title="Temp." 
                value={isSensorOffline ? '--' : animal?.temperature?.toFixed(1) || '--'} 
                unit="°C" 
                icon="thermometer" 
                color={COLORS.danger} 
                subValue="Physiologique"
              />
              <HealthWidget 
                title="Batterie" 
                value={animal?.battery_level || '--'} 
                unit="%" 
                icon="battery" 
                color={COLORS.safe} 
                subValue="Collier IOT"
              />
              <HealthWidget 
                title="Signal" 
                value={animal?.signal_strength || '--'} 
                unit="%" 
                icon="wifi" 
                color={COLORS.primary} 
                subValue="Réseau"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Maintenance Système</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ID Matériel :</Text>
                <Text style={styles.infoValue}>{animal?.device_id || 'Non lié'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dernière Sync :</Text>
                <Text style={styles.infoValue}>
                  {animal?.last_sync ? new Date(animal.last_sync).toLocaleTimeString() : 'Jamais'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: COLORS.surface },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  editBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
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
  deviceBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  deviceBubbleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  deviceBubbleText: { color: COLORS.subtext, fontSize: 13, fontWeight: '700', marginLeft: 8 },
  zoneScroll: { gap: 12, paddingRight: 40 },
  zoneCard: { width: 140, backgroundColor: COLORS.surface, borderRadius: 20, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  zoneCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '11' },
  zoneIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  zoneName: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginBottom: 5 },
  saveBtn: { height: 58, backgroundColor: COLORS.primary, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  dashboard: { padding: 20 },
  card: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, marginBottom: 20 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 15 },
  actuatorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  actuatorInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actuatorName: { color: COLORS.text, fontWeight: '700' },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: COLORS.background, padding: 4 },
  toggleActive: { backgroundColor: COLORS.primary },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.subtext },
  toggleCircleActive: { backgroundColor: '#fff', alignSelf: 'flex-end' },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5 },
  staleText: { color: COLORS.danger, fontSize: 10, fontWeight: '900' },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  healthCard: { width: (width - 50) / 2, backgroundColor: COLORS.surface, borderRadius: 20, padding: 15 },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  healthTitle: { color: COLORS.subtext, fontSize: 12, fontWeight: '700' },
  healthBody: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  healthValue: { fontSize: 24, fontWeight: '900' },
  healthUnit: { color: COLORS.subtext, fontSize: 12 },
  healthSub: { color: COLORS.subtext, fontSize: 10, marginTop: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { color: COLORS.subtext, fontSize: 13 },
  infoValue: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
});
