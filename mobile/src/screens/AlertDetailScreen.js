import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAlertStore from '../store/alertStore';

const { width } = Dimensions.get('window');

const COLORS = {
  primary:    '#4F46E5',
  background: '#0A0F1E',
  surface:    '#131929',
  card:       '#1E2A45',
  text:       '#F0F4FF',
  subtext:    '#94A3B8',
  danger:     '#EF4444',
  warning:    '#F59E0B',
  success:    '#22C55E',
  border:     'rgba(255,255,255,0.08)',
};

const TYPE_ICONS = {
  geofence_breach:    { icon: 'map', color: COLORS.danger, label: 'ZONE' },
  high_temperature:   { icon: 'thermometer', color: COLORS.warning, label: 'CHALEUR' },
  abnormal_heart_rate: { icon: 'heart', color: COLORS.danger, label: 'CARDIAQUE' },
  low_battery:        { icon: 'battery-dead', color: COLORS.warning, label: 'BATTERIE' },
  device_offline:     { icon: 'cloud-offline', color: COLORS.subtext, label: 'OFFLINE' },
  no_movement:        { icon: 'pause-circle', color: COLORS.primary, label: 'IMMOBILE' },
};

const GUIDANCE = {
  geofence_breach:    "L'animal a quitté la zone de sécurité. Localisez-le et ramenez-le immédiatement.",
  high_temperature:   "Température corporelle anormale. Vérifiez les signes de maladie ou de stress thermique.",
  abnormal_heart_rate: "Rythme cardiaque irrégulier. L'animal peut être en détresse ou blessé.",
  low_battery:        "La batterie du collier est critique. Veuillez la charger pour éviter de perdre le signal.",
  device_offline:     "Le dispositif ne répond plus. Vérifiez la connectivité ou l'état physique du collier.",
  no_movement:        "Aucun mouvement détecté depuis longtemps. Vérifiez si l'animal est coincé ou endormi.",
};

export default function AlertDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { alert } = route.params;
  const { acknowledgeAlert, resolveAlert } = useAlertStore();

  const typeInfo = TYPE_ICONS[alert.type] || { icon: 'alert-circle', color: COLORS.warning };
  const date = new Date(alert.created_at).toLocaleString();

  const handleAcknowledge = async () => {
    await acknowledgeAlert(alert.id);
    navigation.goBack();
  };

  const handleResolve = async () => {
    await resolveAlert(alert.id);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alert Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Severity Banner */}
        <View style={[styles.banner, { backgroundColor: typeInfo.color + '22', borderColor: typeInfo.color }]}>
          <Ionicons name={typeInfo.icon} size={32} color={typeInfo.color} />
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: typeInfo.color }]}>
              {alert.type.replace('_', ' ').toUpperCase()}
            </Text>
            <Text style={styles.bannerSub}>{alert.severity.toUpperCase()} PRIORITY</Text>
          </View>
        </View>

        {/* Message Card */}
        <View style={styles.card}>
          <Text style={styles.animalLabel}>🐄 {alert.animal_name}</Text>
          <Text style={styles.message}>{alert.message}</Text>
          <Text style={styles.timestamp}>🕒 {date}</Text>
        </View>

        {/* Map View */}
        {alert.location?.coordinates && (
          <View style={styles.mapContainer}>
            <Text style={styles.sectionTitle}>Position au moment de l'alerte</Text>
            <View style={styles.mapWrapper}>
              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                mapType="hybrid"
                initialRegion={{
                  latitude: alert.location.coordinates[1],
                  longitude: alert.location.coordinates[0],
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
              >
                <Marker
                  coordinate={{ 
                    latitude: alert.location.coordinates[1], 
                    longitude: alert.location.coordinates[0] 
                  }}
                >
                  <View style={[styles.marker, { borderColor: typeInfo.color }]}>
                    <Ionicons name="paw" size={18} color={typeInfo.color} />
                  </View>
                </Marker>
              </MapView>
            </View>
          </View>
        )}

        {/* Guidance Card */}
        <View style={styles.card}>
          <View style={styles.guidanceHeader}>
            <Ionicons name="bulb-outline" size={20} color={COLORS.warning} />
            <Text style={styles.guidanceTitle}>Conseils Agriculteur</Text>
          </View>
          <Text style={styles.guidanceText}>{GUIDANCE[alert.type] || "Vérifiez l'animal immédiatement pour tout signe de détresse."}</Text>
        </View>

        {/* Action Buttons */}
        {alert.status === 'active' && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.ackBtn]} onPress={handleAcknowledge}>
              <Text style={styles.btnText}>Acknowledge</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.resolveBtn]} onPress={handleResolve}>
              <Text style={styles.btnText}>Mark as Resolved</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.surface },
  backBtn:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginLeft: 16 },
  scroll:    { padding: 20, paddingBottom: 40 },
  
  banner: { 
    flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, 
    borderWidth: 1, marginBottom: 20 
  },
  bannerText: { marginLeft: 16 },
  bannerTitle: { fontSize: 18, fontWeight: '800' },
  bannerSub: { color: COLORS.subtext, fontSize: 12, fontWeight: '600', marginTop: 2 },

  card: { 
    backgroundColor: COLORS.card, borderRadius: 20, padding: 20, 
    marginBottom: 20, borderWidth: 1, borderColor: COLORS.border 
  },
  animalLabel: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { color: COLORS.text, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  timestamp: { color: COLORS.subtext, fontSize: 12 },

  mapContainer: { marginBottom: 20 },
  sectionTitle: { color: COLORS.subtext, fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 4 },
  mapWrapper: { height: 200, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  map: { ...StyleSheet.absoluteFillObject },
  marker: { backgroundColor: COLORS.surface, padding: 6, borderRadius: 12, borderWidth: 2 },

  guidanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  guidanceTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  guidanceText: { color: COLORS.subtext, fontSize: 14, lineHeight: 20 },

  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ackBtn: { backgroundColor: COLORS.warning },
  resolveBtn: { backgroundColor: COLORS.success },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
