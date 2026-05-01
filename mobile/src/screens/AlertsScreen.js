import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAlertStore from '../store/alertStore';
import useThemeStore from '../store/themeStore';
import { SHADOWS } from '../config/theme';

export default function AlertsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { alerts, fetchAlerts, isLoading, resolveAlert } = useAlertStore();
  const { getColors, isDarkMode } = useThemeStore();
  const COLORS = getColors();
  const styles = createStyles(COLORS);
  
  const [filter, setFilter] = useState('all'); // all, critical, warning

  useEffect(() => {
    fetchAlerts();
  }, []);

  const getFilteredAlerts = () => {
    if (filter === 'critical') return alerts.filter(a => a.severity === 'critical');
    if (filter === 'warning') return alerts.filter(a => a.severity === 'high');
    return alerts;
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'critical': return { color: COLORS.danger, bg: COLORS.danger + '15', label: 'CRITIQUE' };
      case 'high': return { color: COLORS.warning, bg: COLORS.warning + '15', label: 'ATTENTION' };
      default: return { color: COLORS.primary, bg: COLORS.primary + '15', label: 'INFO' };
    }
  };

  const renderAlertItem = ({ item }) => {
    const sev = getSeverityStyle(item.severity);
    const date = new Date(item.created_at);
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: sev.bg }]}>
            <MaterialCommunityIcons 
              name={item.type === 'geofence_breach' ? 'map-marker-alert' : 'bell-ring'} 
              size={24} 
              color={sev.color} 
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.alertTitle}>{item.title || 'Alerte Système'}</Text>
            <Text style={styles.alertMeta}>{date.toLocaleTimeString()} · {item.animal_name || 'Général'}</Text>
          </View>
          <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
            <Text style={[styles.sevText, { color: sev.color }]}>{sev.label}</Text>
          </View>
        </View>

        <Text style={styles.alertBody}>{item.message}</Text>

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => resolveAlert(item.id)}
          >
            <Ionicons name="checkmark-done" size={18} color={COLORS.success} />
            <Text style={[styles.actionText, { color: COLORS.success }]}>Résoudre</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Alertes</Text>
            <Text style={styles.subtitle}>Sécurité du troupeau</Text>
          </View>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeText}>{alerts.filter(a => !a.is_resolved).length}</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        {['all', 'critical', 'warning'].map(f => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterChip, filter === f && styles.activeChip]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.activeChipText]}>
              {f === 'all' ? 'Toutes' : f === 'critical' ? 'Critiques' : 'Attention'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={getFilteredAlerts()}
          renderItem={renderAlertItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchAlerts} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={64} color={COLORS.success} />
              <Text style={styles.emptyTitle}>Tout est calme</Text>
              <Text style={styles.emptySubtitle}>Aucune alerte en cours pour le moment.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  
  badgeCount: { backgroundColor: COLORS.danger, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...SHADOWS.soft },
  badgeText: { color: COLORS.white, fontSize: 14, fontWeight: '900' },

  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginTop: 15, marginBottom: 15 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  activeChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  activeChipText: { color: COLORS.white },

  list: { paddingHorizontal: 20, paddingBottom: 100 },
  card: { backgroundColor: COLORS.card, borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerInfo: { flex: 1 },
  alertTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  alertMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  
  sevBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sevText: { fontSize: 9, fontWeight: '900' },

  alertBody: { fontSize: 14, color: COLORS.text, marginTop: 16, lineHeight: 20 },

  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderColor: COLORS.divider },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.background, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  actionText: { fontSize: 13, fontWeight: '800' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 20 },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 10 },
});
