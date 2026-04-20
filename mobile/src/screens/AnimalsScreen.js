import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, TextInput, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAnimalStore from '../store/animalStore';

const { width } = Dimensions.get('window');

const COLORS = {
  primary:    '#6366F1', 
  secondary:  '#8B5CF6', 
  background: '#0F172A', 
  surface:    '#1E293B', 
  text:       '#F8FAFC', 
  subtext:    '#94A3B8', 
  safe:       '#10B981', 
  warning:    '#F59E0B', 
  danger:     '#EF4444', 
  offline:    '#64748B', 
  border:     'rgba(255, 255, 255, 0.06)',
};

const TYPE_ICONS = {
  bovine:  'cow',
  ovine:   'sheep',
  caprine: 'sheep',
  equine:  'horse-variant',
  other:   'paw',
};

export default function AnimalsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { 
    animals, fetchAnimals, isFetchingMore, pagination, 
    setFilters, filters, stats, deleteAnimal 
  } = useAnimalStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAnimals(true);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnimals(true);
    setRefreshing(false);
  };

  const handleSearch = (val) => {
    setSearch(val);
    setFilters({ search: val });
  };

  const toggleFilter = (type) => {
    const newType = filters.type === type ? '' : type;
    setFilters({ type: newType });
  };

  const handleDelete = (animal) => {
    Alert.alert(
      'Remove Animal',
      `Are you sure you want to remove "${animal.name}"? This action releases its device for reuse.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: () => deleteAnimal(animal.id) 
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.headerTitle}>My Animals</Text>
          <Text style={styles.headerSub}>Managing {stats.total} livestock</Text>
        </View>
        <TouchableOpacity 
          style={styles.statsIcon} 
          onPress={() => fetchAnimals(true)}
        >
          <Ionicons name="refresh" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <StatItem label="Safe" value={stats.safe} color={COLORS.safe} icon="shield-checkmark" />
        <StatItem label="Alert" value={stats.danger + stats.warning} color={COLORS.danger} icon="alert-circle" />
        <StatItem label="Offline" value={stats.offline} color={COLORS.offline} icon="cloud-offline" />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={COLORS.subtext} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or device..."
            placeholderTextColor={COLORS.subtext}
            value={search}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      <View style={styles.filterScroll}>
        {['bovine', 'ovine', 'equine', 'caprine'].map(t => (
          <TouchableOpacity 
            key={t}
            style={[styles.filterBtn, filters.type === t && styles.filterBtnActive]}
            onPress={() => toggleFilter(t)}
          >
            <MaterialCommunityIcons 
              name={TYPE_ICONS[t]} 
              size={18} 
              color={filters.type === t ? '#fff' : COLORS.subtext} 
            />
            <Text style={[styles.filterBtnText, filters.type === t && styles.filterBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAnimalCard = ({ item }) => {
    const statusColor = COLORS[item.status] || COLORS.offline;
    const lastSeen = item.last_seen ? new Date(item.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never';
    const battery = item.battery_level ?? 100;
    
    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('AnimalView', { animalId: item.id })}
      >
        <View style={styles.cardMain}>
          <View style={[styles.avatarBox, { borderColor: statusColor + '44' }]}>
            <MaterialCommunityIcons name={TYPE_ICONS[item.type] || 'paw'} size={32} color={statusColor} />
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.cardHeader}>
              <Text style={styles.animalName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{item.type}</Text>
              </View>
            </View>
            
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={COLORS.subtext} />
                <Text style={styles.metaText}>{lastSeen}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons 
                  name={battery > 20 ? "battery-charging" : "battery-dead"} 
                  size={14} 
                  color={battery > 20 ? COLORS.safe : COLORS.danger} 
                />
                <Text style={[styles.metaText, battery <= 20 && { color: COLORS.danger }]}>{battery}%</Text>
              </View>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.footerStatus, { color: statusColor }]}>
            ● {item.status.toUpperCase()}
          </Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger + '88'} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={animals}
        keyExtractor={item => item.id}
        renderItem={renderAnimalCard}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        onEndReached={() => fetchAnimals(false)}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingMore ? <ActivityIndicator style={{ margin: 20 }} color={COLORS.primary} /> : null}
        ListEmptyComponent={!isFetchingMore && (
          <View style={styles.empty}>
            <Ionicons name="paw-outline" size={48} color={COLORS.surface} />
            <Text style={styles.emptyText}>No animals found matching your search.</Text>
          </View>
        )}
      />

      <TouchableOpacity 
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AnimalDetail', { mode: 'create' })}
      >
        <View style={styles.fabInner}>
          <Ionicons name="add" size={32} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Undo Snackbar */}
      {useAnimalStore.getState().lastDeletedAnimal && (
        <View style={[styles.undoBar, { bottom: insets.bottom + 100 }]}>
          <Text style={styles.undoText}>Animal removed</Text>
          <TouchableOpacity onPress={() => useAnimalStore.getState().restoreAnimal()}>
            <Text style={styles.undoAction}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function StatItem({ label, value, color, icon }) {
  return (
    <View style={[styles.statItem, { borderColor: color + '22' }]}>
      <Ionicons name={icon} size={18} color={color} />
      <View style={{ marginLeft: 8 }}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16 },
  header: { marginBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  statsIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 12, borderRadius: 16, borderWidth: 1 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.subtext, fontWeight: '600', textTransform: 'uppercase' },

  searchContainer: { marginBottom: 12 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, height: 50, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 15, paddingHorizontal: 12 },

  filterScroll: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterBtnText: { color: COLORS.subtext, fontSize: 12, fontWeight: '700', marginLeft: 6 },
  filterBtnTextActive: { color: '#fff' },

  card: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { width: 60, height: 60, borderRadius: 20, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, position: 'relative' },
  statusDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: COLORS.surface },
  cardInfo: { flex: 1, marginLeft: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  animalName: { color: COLORS.text, fontSize: 18, fontWeight: '800', flex: 1 },
  typeBadge: { backgroundColor: COLORS.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { color: COLORS.subtext, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.subtext, fontSize: 12, fontWeight: '600' },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  footerStatus: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  deleteBtn: { padding: 4 },

  fab: { position: 'absolute', right: 20, width: 64, height: 64, borderRadius: 32, elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  fabInner: { flex: 1, borderRadius: 32, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },

  empty: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyText: { color: COLORS.subtext, fontSize: 14, textAlign: 'center', marginTop: 16, lineHeight: 20 },

  undoBar: { 
    position: 'absolute', left: 20, right: 20, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 16, 
    paddingHorizontal: 20, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.primary + '44',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width:0, height:4 }
  },
  undoText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  undoAction: { color: COLORS.primary, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
