import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAnimalStore from '../store/animalStore';
import { subscribeAnimal, unsubscribeAnimal } from '../services/socketService';

const { width } = Dimensions.get('window');

const COLORS = {
  primary:    '#4F46E5',
  background: '#0A0F1E',
  surface:    '#131929',
  card:       '#1E2A45',
  text:       '#F0F4FF',
  subtext:    '#94A3B8',
  safe:       '#22C55E',
  warning:    '#F59E0B',
  danger:     '#EF4444',
  border:     'rgba(255,255,255,0.08)',
};

export default function AnimalViewScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { animalId } = route.params;
  const { animals, fetchAnimal } = useAnimalStore();
  
  // Find the animal in the global store to get real-time updates
  const animal = animals.find((a) => a.id === animalId);
  const [loading, setLoading] = useState(!animal);

  useEffect(() => {
    const load = async () => {
      await fetchAnimal(animalId);
      setLoading(false);
    };
    load();
    subscribeAnimal(animalId);
    return () => unsubscribeAnimal(animalId);
  }, [animalId]);

  // Status interpretation logic
  const healthStatus = useMemo(() => {
    if (!animal) return { label: 'Unknown', color: COLORS.subtext, message: 'No data available' };
    
    const isOutside = animal.status === 'danger';
    const isHighTemp = animal.temperature > 40;
    const isLowActivity = animal.activity < 20;

    if (isOutside || isHighTemp) {
      return { 
        label: 'Alert', 
        color: COLORS.danger, 
        message: isOutside ? 'Animal has exited the safe zone!' : 'Abnormal body temperature detected.' 
      };
    }
    if (isLowActivity) {
      return { 
        label: 'Warning', 
        color: COLORS.warning, 
        message: 'Low activity level detected. Animal may be unwell.' 
      };
    }
    return { 
      label: 'Normal', 
      color: COLORS.safe, 
      message: 'Animal is inside the zone and showing healthy metrics.' 
    };
  }, [animal]);

  if (loading || !animal) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{animal.name}</Text>
          <Text style={styles.headerSub}>Real-time Dashboard</Text>
        </View>
        <TouchableOpacity 
          style={styles.editBtn} 
          onPress={() => navigation.navigate('AnimalDetail', { animal, mode: 'edit' })}
        >
          <Ionicons name="settings-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Interpretation Card */}
        <View style={[styles.statusCard, { borderColor: healthStatus.color + '44' }]}>
          <View style={[styles.statusIndicator, { backgroundColor: healthStatus.color }]}>
            <Ionicons 
              name={healthStatus.label === 'Normal' ? 'shield-checkmark' : 'alert-circle'} 
              size={24} color="#fff" 
            />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusLabel, { color: healthStatus.color }]}>{healthStatus.label} State</Text>
            <Text style={styles.statusMessage}>{healthStatus.message}</Text>
          </View>
        </View>

        {/* Map View */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            mapType="hybrid"
            initialRegion={{
              latitude: parseFloat(animal.latitude || 35.038),
              longitude: parseFloat(animal.longitude || 9.484),
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            region={{
              latitude: parseFloat(animal.latitude || 35.038),
              longitude: parseFloat(animal.longitude || 9.484),
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            {animal.center_lat && (
              <Circle
                center={{ latitude: parseFloat(animal.center_lat), longitude: parseFloat(animal.center_lon) }}
                radius={parseFloat(animal.radius_m)}
                strokeColor={COLORS.primary + '99'}
                fillColor={COLORS.primary + '22'}
                strokeWidth={2}
              />
            )}
            <Marker
              coordinate={{ latitude: parseFloat(animal.latitude), longitude: parseFloat(animal.longitude) }}
              title={animal.name}
            >
              <View style={[styles.markerContainer, { borderColor: healthStatus.color }]}>
                <Ionicons name="paw" size={20} color={healthStatus.color} />
              </View>
            </Marker>
          </MapView>
          <View style={styles.coordBadge}>
            <Text style={styles.coordText}>
              📍 {parseFloat(animal.latitude).toFixed(6)}, {parseFloat(animal.longitude).toFixed(6)}
            </Text>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          {/* Temperature */}
          <View style={styles.metricCard}>
            <View style={[styles.iconBox, { backgroundColor: '#FF4D4D22' }]}>
              <Ionicons name="thermometer" size={24} color="#FF4D4D" />
            </View>
            <Text style={styles.metricValue}>
              {animal.temperature ? `${parseFloat(animal.temperature).toFixed(1)}°C` : '--'}
            </Text>
            <Text style={styles.metricLabel}>Body Temp</Text>
          </View>

          {/* Activity */}
          <View style={styles.metricCard}>
            <View style={[styles.iconBox, { backgroundColor: '#4DFF8822' }]}>
              <Ionicons name="walk" size={24} color="#4DFF88" />
            </View>
            <Text style={styles.metricValue}>
              {animal.activity ? `${Math.round(animal.activity)}%` : '--'}
            </Text>
            <Text style={styles.metricLabel}>Activity Level</Text>
          </View>
        </View>

        {/* Details List */}
        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>Animal Information</Text>
          <DetailItem label="Type" value={animal.type} icon="paw-outline" />
          <DetailItem label="Breed" value={animal.breed || 'Not specified'} icon="ribbon-outline" />
          <DetailItem label="Weight" value={animal.weight_kg ? `${animal.weight_kg} kg` : '--'} icon="fitness-outline" />
          <DetailItem label="Device ID" value={animal.device_id || 'Not linked'} icon="hardware-chip-outline" />
          <DetailItem 
            label="Last Sync" 
            value={animal.last_seen ? new Date(animal.last_seen).toLocaleTimeString() : 'Never'} 
            icon="time-outline" 
          />
        </View>
      </ScrollView>
    </View>
  );
}

function DetailItem({ label, value, icon }) {
  return (
    <View style={styles.detailItem}>
      <View style={styles.detailIconBox}>
        <Ionicons name={icon} size={18} color={COLORS.subtext} />
      </View>
      <View style={styles.detailTexts}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:COLORS.background },
  centered:  { flex:1, backgroundColor:COLORS.background, justifyContent:'center', alignItems:'center' },
  header:    { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingBottom:16, backgroundColor:COLORS.surface },
  backBtn:   { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center', backgroundColor:COLORS.card },
  headerTitleContainer: { flex:1, marginLeft:12 },
  headerTitle: { color:COLORS.text, fontSize:20, fontWeight:'800' },
  headerSub:   { color:COLORS.subtext, fontSize:12 },
  editBtn:     { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center', backgroundColor:COLORS.card },
  scrollContent: { padding:20, paddingBottom:40 },
  
  statusCard: { 
    flexDirection:'row', backgroundColor:COLORS.card, borderRadius:20, 
    padding:16, marginBottom:20, borderWidth:1, alignItems:'center' 
  },
  statusIndicator: { width:48, height:48, borderRadius:24, justifyContent:'center', alignItems:'center' },
  statusTextContainer: { marginLeft:16, flex:1 },
  statusLabel: { fontSize:16, fontWeight:'700' },
  statusMessage: { color:COLORS.subtext, fontSize:13, marginTop:2 },

  mapContainer: { height:220, borderRadius:24, overflow:'hidden', marginBottom:20, position:'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  markerContainer: { 
    backgroundColor:COLORS.surface, padding:6, borderRadius:12, 
    borderWidth:2, shadowColor:'#000', shadowOffset:{width:0,height:2}, 
    shadowOpacity:0.3, shadowRadius:4 
  },
  coordBadge: { 
    position:'absolute', bottom:12, left:12, backgroundColor:'rgba(10,15,30,0.8)', 
    paddingHorizontal:12, paddingVertical:6, borderRadius:10 
  },
  coordText: { color:COLORS.text, fontSize:11, fontWeight:'600' },

  metricsGrid: { flexDirection:'row', gap:12, marginBottom:20 },
  metricCard: { 
    flex:1, backgroundColor:COLORS.card, borderRadius:20, 
    padding:20, alignItems:'center', borderWidth:1, borderColor:COLORS.border 
  },
  iconBox: { width:48, height:48, borderRadius:24, justifyContent:'center', alignItems:'center', marginBottom:12 },
  metricValue: { color:COLORS.text, fontSize:22, fontWeight:'800' },
  metricLabel: { color:COLORS.subtext, fontSize:12, marginTop:4, fontWeight:'600' },

  detailsContainer: { backgroundColor:COLORS.card, borderRadius:24, padding:20, borderWidth:1, borderColor:COLORS.border },
  sectionTitle: { color:COLORS.text, fontSize:16, fontWeight:'700', marginBottom:16 },
  detailItem: { flexDirection:'row', alignItems:'center', marginBottom:16 },
  detailIconBox: { width:32, height:32, borderRadius:10, backgroundColor:COLORS.surface, justifyContent:'center', alignItems:'center' },
  detailTexts: { marginLeft:12 },
  detailLabel: { color:COLORS.subtext, fontSize:11, fontWeight:'600' },
  detailValue: { color:COLORS.text, fontSize:14, fontWeight:'700', marginTop:1 },
});
