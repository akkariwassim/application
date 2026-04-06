import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const COLORS = {
  primary:'#4F46E5', background:'#0A0F1E', surface:'#131929',
  card:'#1E2A45', text:'#F0F4FF', subtext:'#94A3B8',
  safe:'#22C55E', warning:'#F59E0B', danger:'#EF4444',
  border:'rgba(255,255,255,0.08)',
};

function StatCard({ icon, label, value, color }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '44' }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HistoryScreen({ route }) {
  const { animal } = route.params;
  const [positions, setPositions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState('today');

  const periodOptions = [
    { key:'today',  label:'Today',    hours: 24  },
    { key:'week',   label:'7 Days',   hours: 168 },
    { key:'month',  label:'30 Days',  hours: 720 },
  ];

  useEffect(() => {
    fetchHistory();
  }, [period]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const hours = periodOptions.find(p => p.key === period)?.hours || 24;
      const from  = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const { data } = await api.get(`/positions/${animal.id}?from=${from}&limit=500`);
      setPositions(data);
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Compute stats ───────────────────────────────────────────
  const validPositions = positions.filter(p => p.latitude && p.longitude);

  const totalDistanceKm = validPositions.reduce((acc, pos, i) => {
    if (i === 0) return 0;
    const prev = validPositions[i - 1];
    const dLat = pos.latitude - prev.latitude;
    const dLon = pos.longitude - prev.longitude;
    const d = Math.sqrt(dLat ** 2 + dLon ** 2) * 111; // rough km
    return acc + d;
  }, 0);

  const speeds   = validPositions.map(p => (p.speed_mps || 0) * 3.6);
  const maxSpeed = Math.max(...speeds, 0);

  const polylineCoords = validPositions.map(p => ({
    latitude: parseFloat(p.latitude),
    longitude: parseFloat(p.longitude),
  }));

  const firstPos = polylineCoords[polylineCoords.length - 1];
  const lastPos  = polylineCoords[0];

  const mapRegion = firstPos
    ? { latitude: firstPos.latitude, longitude: firstPos.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 35.038, longitude: 9.484, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{animal.name}'s History</Text>
        <View style={styles.periodRow}>
          {periodOptions.map(p => (
            <TouchableOpacity key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodActive]}
              onPress={() => setPeriod(p.key)}>
              <Text style={[styles.periodText, period === p.key && { color:COLORS.primary }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop:40 }} />
      ) : (
        <>
          {/* Stats */}
          <View style={styles.statsRow}>
            <StatCard icon="footsteps"     label="Distance"  value={`${totalDistanceKm.toFixed(2)} km`} color={COLORS.primary} />
            <StatCard icon="speedometer"   label="Max Speed" value={`${maxSpeed.toFixed(1)} km/h`}       color={COLORS.warning} />
            <StatCard icon="location"      label="Points"    value={String(validPositions.length)}        color={COLORS.safe}    />
          </View>

          {/* Map with Trajectory */}
          {polylineCoords.length > 0 && (
            <View style={styles.mapBox}>
              <MapView style={styles.map} provider={PROVIDER_GOOGLE}
                initialRegion={mapRegion} mapType="hybrid">
                {/* Path */}
                <Polyline coordinates={polylineCoords} strokeColor={COLORS.primary}
                  strokeWidth={3} lineDashPattern={[0]} />
                {/* Start point */}
                {firstPos && <Marker coordinate={firstPos} title="Oldest" pinColor="green" />}
                {/* End point (latest) */}
                {lastPos && <Marker coordinate={lastPos} title="Latest" pinColor="red" />}
              </MapView>
            </View>
          )}

          {/* Position List */}
          <Text style={styles.listTitle}>Recent Positions ({validPositions.length})</Text>
          {validPositions.slice(0, 20).map((pos, i) => (
            <View key={pos.id} style={styles.posRow}>
              <View style={[styles.posNum, { backgroundColor: i === 0 ? COLORS.danger+'33' : COLORS.surface }]}>
                <Text style={styles.posNumText}>{i + 1}</Text>
              </View>
              <View style={styles.posInfo}>
                <Text style={styles.posCoords}>
                  {parseFloat(pos.latitude).toFixed(5)}, {parseFloat(pos.longitude).toFixed(5)}
                </Text>
                <Text style={styles.posTime}>{new Date(pos.recorded_at).toLocaleString()}</Text>
              </View>
              {pos.speed_mps != null && (
                <Text style={styles.posSpeed}>{(pos.speed_mps * 3.6).toFixed(1)} km/h</Text>
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:COLORS.background },
  scroll:      { paddingBottom:40 },
  header:      { padding:20 },
  title:       { fontSize:22, fontWeight:'800', color:COLORS.text, marginBottom:12 },
  periodRow:   { flexDirection:'row', gap:8 },
  periodBtn:   { paddingHorizontal:14, paddingVertical:7, borderRadius:20, borderWidth:1, borderColor:COLORS.border, backgroundColor:COLORS.surface },
  periodActive:{ borderColor:COLORS.primary, backgroundColor:COLORS.primary+'22' },
  periodText:  { color:COLORS.subtext, fontSize:13, fontWeight:'500' },
  statsRow:    { flexDirection:'row', paddingHorizontal:16, gap:10, marginBottom:16 },
  statCard:    { flex:1, backgroundColor:COLORS.card, borderRadius:16, padding:14, alignItems:'center', gap:4, borderWidth:1 },
  statValue:   { fontSize:16, fontWeight:'800' },
  statLabel:   { color:COLORS.subtext, fontSize:10, textAlign:'center' },
  mapBox:      { marginHorizontal:16, borderRadius:16, overflow:'hidden', height:260, marginBottom:20 },
  map:         { flex:1 },
  listTitle:   { color:COLORS.text, fontSize:16, fontWeight:'700', marginHorizontal:16, marginBottom:10 },
  posRow:      { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderColor:COLORS.border, gap:12 },
  posNum:      { width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center' },
  posNumText:  { color:COLORS.subtext, fontSize:12, fontWeight:'600' },
  posInfo:     { flex:1 },
  posCoords:   { color:COLORS.text, fontSize:13, fontWeight:'500' },
  posTime:     { color:COLORS.subtext, fontSize:11, marginTop:2 },
  posSpeed:    { color:COLORS.primary, fontSize:12, fontWeight:'600' },
});
