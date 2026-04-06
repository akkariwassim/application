import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAlertStore from '../store/alertStore';

const COLORS = {
  primary:'#4F46E5', background:'#0A0F1E', surface:'#131929',
  card:'#1E2A45', text:'#F0F4FF', subtext:'#94A3B8',
  safe:'#22C55E', warning:'#F59E0B', danger:'#EF4444', offline:'#6B7280',
  border:'rgba(255,255,255,0.08)', info:'#3B82F6',
};

const SEV_COLOR = { info: COLORS.info, warning: COLORS.warning, critical: COLORS.danger };
const SEV_ICON  = { info: 'information-circle', warning: 'warning', critical: 'alert-circle' };

function AlertCard({ alert, onAcknowledge, onResolve }) {
  const color = SEV_COLOR[alert.severity] || COLORS.warning;
  const date  = new Date(alert.created_at).toLocaleString();

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.sevBadge, { backgroundColor: color + '22' }]}>
          <Ionicons name={SEV_ICON[alert.severity]} size={14} color={color} />
          <Text style={[styles.sevText, { color }]}>{alert.severity.toUpperCase()}</Text>
        </View>
        <Text style={styles.statusChip}>{alert.status}</Text>
      </View>

      <Text style={styles.animalName}>🐄 {alert.animal_name}</Text>
      <Text style={styles.message}>{alert.message}</Text>
      <Text style={styles.date}>{date}</Text>

      {alert.status === 'active' && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: COLORS.warning }]}
            onPress={() => onAcknowledge(alert.id)}>
            <Text style={[styles.actionText, { color: COLORS.warning }]}>Acknowledge</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: COLORS.safe }]}
            onPress={() => onResolve(alert.id)}>
            <Text style={[styles.actionText, { color: COLORS.safe }]}>Resolve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const { alerts, unreadCount, fetchAlerts, acknowledgeAlert, resolveAlert, isLoading } = useAlertStore();
  const [filterSev, setFilterSev] = useState(null);
  const [filterStatus, setFilterStatus] = useState('active');

  useEffect(() => {
    fetchAlerts({ severity: filterSev, status: filterStatus });
  }, [filterSev, filterStatus]);

  const filters = ['active','acknowledged','resolved'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount} active</Text>
          </View>
        )}
      </View>

      {/* Status Filter */}
      <View style={styles.filterRow}>
        {filters.map((s) => (
          <TouchableOpacity key={s} style={[styles.filterBtn, filterStatus === s && styles.filterActive]}
            onPress={() => setFilterStatus(filterStatus === s ? null : s)}>
            <Text style={[styles.filterText, filterStatus === s && styles.filterTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Severity Filter */}
      <View style={styles.filterRow}>
        {['critical','warning','info'].map((s) => (
          <TouchableOpacity key={s} style={[styles.filterBtn, filterSev === s && { borderColor: SEV_COLOR[s], backgroundColor: SEV_COLOR[s] + '22' }]}
            onPress={() => setFilterSev(filterSev === s ? null : s)}>
            <Ionicons name={SEV_ICON[s]} size={14} color={SEV_COLOR[s]} />
            <Text style={[styles.filterText, { color: SEV_COLOR[s] }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && !alerts.length ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => fetchAlerts({ severity: filterSev, status: filterStatus })} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle" size={64} color={COLORS.safe} />
              <Text style={styles.emptyTitle}>All Clear</Text>
              <Text style={styles.emptyText}>No alerts matching your filters</Text>
            </View>
          }
          renderItem={({ item }) => (
            <AlertCard
              alert={item}
              onAcknowledge={acknowledgeAlert}
              onResolve={resolveAlert}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex:1, backgroundColor:COLORS.background },
  header:          { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:16, gap:12 },
  title:           { fontSize:24, fontWeight:'800', color:COLORS.text, flex:1 },
  badge:           { backgroundColor:'rgba(239,68,68,0.2)', borderRadius:12, paddingHorizontal:10, paddingVertical:4 },
  badgeText:       { color:COLORS.danger, fontSize:12, fontWeight:'700' },
  filterRow:       { flexDirection:'row', paddingHorizontal:16, gap:8, marginBottom:4 },
  filterBtn:       { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:COLORS.border, backgroundColor:COLORS.surface },
  filterActive:    { backgroundColor:COLORS.primary+'33', borderColor:COLORS.primary },
  filterText:      { color:COLORS.subtext, fontSize:12 },
  filterTextActive:{ color:COLORS.primary, fontWeight:'600' },
  card:            { backgroundColor:COLORS.card, borderRadius:16, padding:16, marginBottom:12, borderWidth:1, borderColor:COLORS.border, borderLeftWidth:4 },
  cardHeader:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  sevBadge:        { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:10 },
  sevText:         { fontSize:11, fontWeight:'700' },
  statusChip:      { fontSize:11, color:COLORS.subtext, textTransform:'capitalize' },
  animalName:      { color:COLORS.text, fontWeight:'700', fontSize:15, marginBottom:4 },
  message:         { color:COLORS.subtext, fontSize:13, lineHeight:19, marginBottom:8 },
  date:            { color:COLORS.subtext, fontSize:11 },
  actions:         { flexDirection:'row', gap:8, marginTop:12 },
  actionBtn:       { flex:1, paddingVertical:8, borderRadius:10, borderWidth:1, alignItems:'center' },
  actionText:      { fontSize:13, fontWeight:'600' },
  empty:           { alignItems:'center', paddingTop:60 },
  emptyTitle:      { color:COLORS.text, fontSize:20, fontWeight:'700', marginTop:16 },
  emptyText:       { color:COLORS.subtext, fontSize:14, marginTop:8 },
});
