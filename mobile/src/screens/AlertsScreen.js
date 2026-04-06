import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAlertStore from '../store/alertStore';

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
  info:       '#3B82F6',
  border:     'rgba(255,255,255,0.08)',
};

const SEV_COLOR = { info: COLORS.info, warning: COLORS.warning, critical: COLORS.danger };
const SEV_ICON  = { info: 'information-circle', warning: 'warning', critical: 'alert-circle' };
const TYPE_ICON = { 
  geofence_breach: 'map', 
  temperature: 'thermometer', 
  activity: 'pulse' 
};

function AlertCard({ alert, onPress, onAcknowledge, onResolve }) {
  const color = SEV_COLOR[alert.severity] || COLORS.warning;
  const date  = new Date(alert.created_at);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString();

  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: color }]} onPress={() => onPress(alert)} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: color + '22' }]}>
          <Ionicons name={TYPE_ICON[alert.type] || 'alert-circle'} size={14} color={color} />
          <Text style={[styles.typeText, { color }]}>{alert.type.replace('_', ' ').toUpperCase()}</Text>
        </View>
        <Text style={styles.statusChip}>{alert.status}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.animalInfo}>
          <Text style={styles.animalName}>🐄 {alert.animal_name}</Text>
          <Text style={styles.severityTag}>{alert.severity.toUpperCase()}</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>{alert.message}</Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.date}>{dateStr} • {timeStr}</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.subtext} />
      </View>
    </TouchableOpacity>
  );
}

export default function AlertsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { alerts, unreadCount, fetchAlerts, acknowledgeAlert, resolveAlert, isLoading } = useAlertStore();
  
  const [filterSev, setFilterSev] = useState(null);
  const [filterType, setFilterType] = useState(null);
  const [filterStatus, setFilterStatus] = useState('active');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'severity'

  useEffect(() => {
    fetchAlerts({ severity: filterSev, status: filterStatus, type: filterType });
  }, [filterSev, filterStatus, filterType]);

  const sortedAlerts = useMemo(() => {
    let list = [...alerts];
    if (sortBy === 'severity') {
      const sevOrder = { critical: 0, warning: 1, info: 2 };
      list.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
    }
    return list;
  }, [alerts, sortBy]);

  const filters = ['active', 'acknowledged', 'resolved'];
  const types = ['geofence_breach', 'temperature', 'activity'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alerts Center</Text>
          <Text style={styles.subtitle}>{unreadCount} active notifications</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchAlerts({ severity: filterSev, status: filterStatus, type: filterType })}>
          <Ionicons name="refresh" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Primary Status Filters */}
      <View style={styles.filterRow}>
        {filters.map((s) => (
          <TouchableOpacity key={s} style={[styles.statusBtn, filterStatus === s && styles.statusBtnActive]}
            onPress={() => setFilterStatus(filterStatus === s ? null : s)}>
            <Text style={[styles.statusBtnText, filterStatus === s && styles.statusBtnTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub Filters & Sorting */}
      <View style={styles.subFilterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFilterScroll}>
          {/* Type Filters */}
          {types.map((t) => (
            <TouchableOpacity key={t} style={[styles.subFilterBtn, filterType === t && styles.subFilterActive]}
              onPress={() => setFilterType(filterType === t ? null : t)}>
              <Ionicons name={TYPE_ICON[t]} size={12} color={filterType === t ? COLORS.primary : COLORS.subtext} />
              <Text style={[styles.subFilterText, filterType === t && styles.subFilterTextActive]}>{t.split('_')[0]}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.divider} />
          {/* Severity Filters */}
          {['critical', 'warning'].map((s) => (
            <TouchableOpacity key={s} style={[styles.subFilterBtn, filterSev === s && { borderColor: SEV_COLOR[s] }]}
              onPress={() => setFilterSev(filterSev === s ? null : s)}>
              <View style={[styles.dot, { backgroundColor: SEV_COLOR[s] }]} />
              <Text style={[styles.subFilterText, filterSev === s && { color: SEV_COLOR[s] }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading && !alerts.length ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={sortedAlerts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => fetchAlerts({ severity: filterSev, status: filterStatus, type: filterType })} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="notifications-off-outline" size={48} color={COLORS.subtext} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptyText}>No alerts matching the current filters.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <AlertCard
              alert={item}
              onPress={(a) => navigation.navigate('AlertDetail', { alert: a })}
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
  container:       { flex: 1, backgroundColor: COLORS.background },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title:           { fontSize: 24, fontWeight: '800', color: COLORS.text },
  subtitle:        { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  refreshBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  
  filterRow:       { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  statusBtn:       { flex: 1, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  statusBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusBtnText:   { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  statusBtnTextActive: { color: '#fff' },

  subFilterRow:    { marginBottom: 8 },
  subFilterScroll: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  subFilterBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  subFilterActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '11' },
  subFilterText:   { color: COLORS.subtext, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  subFilterTextActive: { color: COLORS.primary },
  dot:             { width: 6, height: 6, borderRadius: 3 },
  divider:         { width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 4 },

  list:            { padding: 20, paddingBottom: 100 },
  card:            { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4 },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  typeBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeText:        { fontSize: 10, fontWeight: '800' },
  statusChip:      { fontSize: 10, color: COLORS.subtext, textTransform: 'uppercase', fontWeight: '700' },
  
  cardBody:        { marginBottom: 12 },
  animalInfo:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  animalName:      { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  severityTag:     { color: COLORS.subtext, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  message:         { color: COLORS.text, fontSize: 13, lineHeight: 18, opacity: 0.8 },
  
  cardFooter:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  date:            { color: COLORS.subtext, fontSize: 10, fontWeight: '600' },

  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:           { alignItems: 'center', paddingTop: 60 },
  emptyIconBox:    { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:      { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  emptyText:       { color: COLORS.subtext, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
