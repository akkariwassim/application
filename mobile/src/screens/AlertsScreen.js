import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, ScrollView,
  StatusBar, TextInput, LayoutAnimation, UIManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAlertStore from '../store/alertStore';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../config/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SEV_CONFIG = {
  critical: { color: '#EF4444', bg: '#FEE2E2', label: 'CRITIQUE', icon: 'flash' },
  high:     { color: '#F59E0B', bg: '#FEF3C7', label: 'HAUT', icon: 'alert-circle' },
  medium:   { color: '#4F46E5', bg: '#E0E7FF', label: 'MOYEN', icon: 'notifications' },
  low:      { color: '#10B981', bg: '#D1FAE5', label: 'FAIBLE', icon: 'information-circle' },
};

const TYPE_MAP = {
  geofence_breach:    { icon: 'map', label: 'Zone' },
  high_temperature:   { icon: 'thermometer', label: 'Surchauffe' },
  abnormal_heart_rate: { icon: 'heart', label: 'Cardio' },
  low_battery:        { icon: 'battery-dead', label: 'Batterie' },
  no_movement:        { icon: 'pause-circle', label: 'Inactif' },
  device_offline:     { icon: 'cloud-offline', label: 'Offline' },
  low_gps_signal:     { icon: 'location-outline', label: 'GPS' },
  sensor_failure:     { icon: 'construct', label: 'Capteur' },
};

function AlertCard({ alert, onResolve, onAcknowledge, onViewAnimal }) {
  const config = SEV_CONFIG[alert.severity] || SEV_CONFIG.medium;
  const type   = TYPE_MAP[alert.type] || { icon: 'notifications', label: alert.type };
  const date   = new Date(alert.created_at);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Time ago calculation
  const getTimeAgo = (d) => {
    const diff = (new Date() - d) / 1000;
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    return d.toLocaleDateString();
  };

  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity 
        style={[styles.card, { borderLeftColor: config.color }]} 
        activeOpacity={0.9}
        onPress={() => onViewAnimal(alert)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.sevBadge, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text style={[styles.sevText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.timeTag}>{getTimeAgo(date)}</Text>
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.animalTitle}>🐄 {alert.animal_name || 'Animal'}</Text>
          <Text style={styles.alertMsg}>{alert.message}</Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.typeBox}>
            <Ionicons name={type.icon} size={14} color={COLORS.textDim} />
            <Text style={styles.typeLabel}>{type.label}</Text>
          </View>

          <View style={styles.actionRow}>
            {(alert.status === 'active' || alert.status === 'new') && (
              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={() => onAcknowledge(alert.id)}
              >
                <Ionicons name="eye-outline" size={16} color={COLORS.primary} />
                <Text style={styles.actionBtnText}>Lu</Text>
              </TouchableOpacity>
            )}
            {alert.status !== 'resolved' && (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.resolveBtn]} 
                onPress={() => onResolve(alert.id)}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
                <Text style={[styles.actionBtnText, { color: COLORS.success }]}>Résoudre</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function AlertsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { alerts, unreadCount, fetchAlerts, acknowledgeAlert, resolveAlert, isLoading } = useAlertStore();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [severityFilter, setSeverityFilter] = useState('all');

  const refreshAction = useCallback(() => {
    fetchAlerts({ 
      status: statusFilter === 'all' ? undefined : statusFilter, 
      severity: severityFilter === 'all' ? undefined : severityFilter,
      search 
    });
  }, [statusFilter, severityFilter, search]);

  useEffect(() => {
    const timer = setTimeout(refreshAction, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [search, statusFilter, severityFilter]);

  const handleResolve = async (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await resolveAlert(id);
  };

  const handleAcknowledge = async (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await acknowledgeAlert(id);
  };

  const statusOptions = [
    { id: 'active', label: 'Actives', icon: 'notifications' },
    { id: 'resolved', label: 'Résolues', icon: 'checkmark-done' },
    { id: 'all', label: 'Toutes', icon: 'list' },
  ];

  const severityOptions = ['all', 'critical', 'high', 'medium', 'low'];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ── Modern Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Monitoring</Text>
            <Text style={styles.headerSubtitle}>{unreadCount} événements critiques</Text>
          </View>
          <TouchableOpacity style={styles.refreshIcon} onPress={refreshAction}>
            <Ionicons name="refresh" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textDim} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher alertes, animaux..."
            placeholderTextColor={COLORS.textDim}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textDim} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          {statusOptions.map(opt => (
            <TouchableOpacity 
              key={opt.id} 
              style={[styles.filterChip, statusFilter === opt.id && styles.filterChipActive]}
              onPress={() => setStatusFilter(opt.id)}
            >
              <Text style={[styles.filterChipText, statusFilter === opt.id && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.divider} />
          {severityOptions.map(sev => (
            <TouchableOpacity 
              key={sev} 
              style={[styles.filterChip, severityFilter === sev && styles.filterChipActive]}
              onPress={() => setSeverityFilter(sev)}
            >
              <Text style={[styles.filterChipText, styles.sevChipText, severityFilter === sev && styles.filterChipTextActive]}>
                {sev.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading && !alerts.length ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Synchronisation IoT...</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => String(item.id || item._id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refreshAction} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyCircle}>
                <Ionicons name="shield-checkmark" size={60} color={COLORS.success + '40'} />
              </View>
              <Text style={styles.emptyTitle}>Rien à signaler</Text>
              <Text style={styles.emptySubtitle}>Le cheptel est en sécurité et sous contrôle.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <AlertCard
              alert={item}
              onResolve={handleResolve}
              onAcknowledge={handleAcknowledge}
              onViewAnimal={(a) => {
                const animalId = a.animal_id?._id || a.animal_id;
                navigation.navigate('Animals', { screen: 'AnimalView', params: { animalId } });
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textMuted, marginTop: 12, fontSize: 13, fontWeight: '600' },
  
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  headerTitle: { color: COLORS.white, fontSize: 26, fontWeight: '800' },
  headerSubtitle: { color: COLORS.textMuted, fontSize: 12 },
  refreshIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14 },

  filterBar: { marginBottom: 4 },
  filterBarContent: { gap: 8, paddingRight: 40 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: COLORS.white },
  sevChipText: { fontSize: 10 },
  divider: { width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 4, alignSelf: 'center' },

  list: { padding: SPACING.lg },
  cardContainer: { marginBottom: SPACING.md },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 6,
    ...SHADOWS.soft,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sevBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sevText: { fontSize: 10, fontWeight: '800' },
  timeTag: { fontSize: 11, color: COLORS.textDim, fontWeight: '600' },

  cardMain: { marginBottom: SPACING.md },
  animalTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  alertMsg: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  typeBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeLabel: { color: COLORS.textDim, fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: COLORS.surface },
  actionBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  resolveBtn: { borderContent: COLORS.success },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.success + '20' },
  emptyTitle: { color: COLORS.white, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySubtitle: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 50, lineHeight: 20 },
});
