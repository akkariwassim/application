import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, ActivityIndicator, Alert, RefreshControl 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useGeofenceStore from '../store/geofenceStore';
import useAnimalStore   from '../store/animalStore';
import { isPointInPolygon, calculatePerimeter } from '../utils/geoUtils';

const COLORS = {
  primary: '#4F46E5', background: '#0A0F1E', surface: '#131929',
  card: '#1C2333', text: '#FFFFFF', subtext: '#94A3B8',
  border: '#2D3748', success: '#10B981', warning: '#F59E0B', danger: '#EF4444'
};

export default function ZonesListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { geofences, fetchGeofences, deleteGeofence, isLoading } = useGeofenceStore();
  const { animals } = useAnimalStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'name', 'area', 'animals', 'alerts', 'newest'
  const [showSortOptions, setShowSortOptions] = useState(false);

  useEffect(() => {
    fetchGeofences();
  }, []);

  const getProcessedZones = () => {
    let processed = [...geofences];
    
    // 1. Calculate virtual fields (animalsInside, perimeter) for dashboard
    processed = processed.map(gf => {
      const coords = gf.polygon_coords ? (typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords) : [];
      const animalsInside = animals.filter(a => !!a.latitude && isPointInPolygon({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) }, coords)).length;
      const perimeter = calculatePerimeter(coords);
      return { ...gf, animalsInside, perimeter };
    });

    // 2. Filter
    if (search) {
      processed = processed.filter(gf => gf.name?.toLowerCase().includes(search.toLowerCase()));
    }
    if (filterType !== 'all') {
      processed = processed.filter(gf => gf.zone_type === filterType);
    }
    // New: Filter by alerts
    if (filterType === 'alerts') {
      processed = processed.filter(gf => gf.active_alerts > 0);
    }

    // 3. Sort
    processed.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'area') return b.area_sqm - a.area_sqm;
      if (sortBy === 'distance') return b.perimeter - a.perimeter;
      if (sortBy === 'animals') return b.animalsInside - a.animalsInside;
      if (sortBy === 'alerts') return b.active_alerts - a.active_alerts;
      return b.id - a.id; // newest
    });

    return processed;
  };

  const handleDelete = (id, name) => {
    Alert.alert(
      'Delete Zone',
      `Are you sure you want to delete "${name || 'this zone'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteGeofence(id) }
      ]
    );
  };

  const renderZoneItem = ({ item }) => {
    const coords = item.polygon_coords ? (typeof item.polygon_coords === 'string' ? JSON.parse(item.polygon_coords) : item.polygon_coords) : [];
    const animalsInside = animals.filter(a => !!a.latitude && isPointInPolygon({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) }, coords)).length;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: item.fill_color || COLORS.primary }]}>
            <Text style={styles.typeText}>{(item.zone_type || 'grazing').toUpperCase()}</Text>
          </View>
          <View style={styles.headerRight}>
            {item.active_alerts > 0 && (
              <View style={styles.alertBadge}>
                <Ionicons name="alert-circle" size={12} color="#fff" />
                <Text style={styles.alertCountText}>{item.active_alerts}</Text>
              </View>
            )}
            {item.is_primary === 1 && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryText}>PRINCIPALE</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.zoneName}>{item.name || `Zone #${item.id}`}</Text>
          
          <View style={styles.metricsContainer}>
            <View style={styles.metric}>
              <Ionicons name="resize-outline" size={14} color={COLORS.subtext} />
              <Text style={styles.metricLabel}>Surface:</Text>
              <Text style={styles.metricValue}>
                {item.area_sqm >= 10000 
                  ? `${(item.area_sqm / 10000).toFixed(2)} Ha` 
                  : `${Math.round(item.area_sqm)} m²`}
              </Text>
            </View>
            <View style={styles.metric}>
              <Ionicons name="analytics-outline" size={14} color={COLORS.subtext} />
              <Text style={styles.metricLabel}>Périmètre:</Text>
              <Text style={styles.metricValue}>
                {item.perimeter >= 1000 
                  ? `${(item.perimeter / 1000).toFixed(2)} km` 
                  : `${Math.round(item.perimeter)} m`}
              </Text>
            </View>
          </View>

          <View style={[styles.metricsContainer, { marginTop: 8 }]}>
            <View style={styles.metric}>
              <Ionicons name="paw-outline" size={14} color={COLORS.subtext} />
              <Text style={styles.metricLabel}>Animaux:</Text>
              <Text style={[styles.metricValue, { color: item.animalsInside > 0 ? COLORS.success : COLORS.subtext }]}>
                {item.animalsInside} présent{item.animalsInside > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => navigation.navigate('Map', { focusZone: item })}
          >
            <Ionicons name="map-outline" size={18} color={COLORS.primary} />
            <Text style={styles.actionText}>Voir</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => navigation.navigate('Geofence', { initialZone: item })}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.warning} />
            <Text style={[styles.actionText, { color: COLORS.warning }]}>Éditer</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.deleteBtn} 
            onPress={() => handleDelete(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Farm Zones</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Geofence')}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.subtext} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search zones..."
          placeholderTextColor={COLORS.subtext}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', 'alerts', 'grazing', 'water', 'rest', 'sensitive']}
          keyExtractor={t => t}
          renderItem={({ item: t }) => (
            <TouchableOpacity 
              style={[styles.filterBtn, filterType === t && styles.activeFilter]}
              onPress={() => setFilterType(t)}
            >
              <Text style={[styles.filterText, filterType === t && styles.activeFilterText]}>
                {t === 'all' ? 'Toutes' : t === 'alerts' ? '⚠️ Alertes' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        />
      </View>

      <View style={styles.sortHeader}>
        <Text style={styles.resultsCount}>{getProcessedZones().length} zones trouvées</Text>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortOptions(!showSortOptions)}>
          <Ionicons name="swap-vertical" size={16} color={COLORS.primary} />
          <Text style={styles.sortBtnText}>Trier par: {sortBy}</Text>
        </TouchableOpacity>
      </View>

      {showSortOptions && (
        <View style={styles.sortMenu}>
          {[
            { id: 'newest', label: 'Plus récent' },
            { id: 'name', label: 'Nom' },
            { id: 'area', label: 'Superficie' },
            { id: 'distance', label: 'Périmètre' },
            { id: 'animals', label: 'Animaux' },
            { id: 'alerts', label: 'Alertes' },
          ].map(s => (
            <TouchableOpacity key={s.id} style={styles.sortItem} onPress={() => { setSortBy(s.id); setShowSortOptions(false); }}>
              <Text style={[styles.sortItemText, sortBy === s.id && { color: COLORS.primary }]}>
                {s.label}
              </Text>
              {sortBy === s.id && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={getProcessedZones()}
          renderItem={renderZoneItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchGeofences} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucune zone trouvée</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title:     { color: COLORS.text, fontSize: 28, fontWeight: '800' },
  addBtn:    { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { marginHorizontal: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, color: COLORS.text, fontSize: 16 },
  filters:   { marginBottom: 12 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  activeFilter: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  activeFilterText: { color: '#fff' },
  sortHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  resultsCount: { color: COLORS.subtext, fontSize: 12 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surface, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  sortBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  sortMenu: { backgroundColor: COLORS.card, marginHorizontal: 20, borderRadius: 16, padding: 8, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sortItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sortItemText: { color: COLORS.subtext, fontSize: 14, fontWeight: '600' },
  list:      { padding: 20, paddingBottom: 100 },
  card:      { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.danger, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 20 },
  alertCountText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  typeBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  typeText:  { color: '#fff', fontSize: 10, fontWeight: '800' },
  primaryBadge: { backgroundColor: COLORS.success + '22', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  primaryText: { color: COLORS.success, fontSize: 10, fontWeight: '800' },
  cardBody:   { marginBottom: 16 },
  zoneName:   { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  metricsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surface, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  metricLabel: { color: COLORS.subtext, fontSize: 12, fontWeight: '500' },
  metricValue: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  deleteBtn:  { padding: 8 },
  empty:      { alignItems: 'center', marginTop: 100 },
  emptyText:  { color: COLORS.subtext, fontSize: 16 }
});
