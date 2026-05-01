import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, ActivityIndicator, Alert, RefreshControl 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import useGeofenceStore from '../store/geofenceStore';
import useAnimalStore   from '../store/animalStore';
import useThemeStore    from '../store/themeStore';
import { isPointInPolygon, calculatePerimeter } from '../utils/geoUtils';
import { SHADOWS } from '../config/theme';

export default function ZonesListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { geofences, fetchGeofences, deleteGeofence, isLoading } = useGeofenceStore();
  const { animals } = useAnimalStore();
  const { getColors, isDarkMode } = useThemeStore();
  const COLORS = getColors();
  const styles = createStyles(COLORS);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showSortOptions, setShowSortOptions] = useState(false);

  useEffect(() => {
    fetchGeofences();
  }, []);

  const getProcessedZones = () => {
    let processed = [...geofences];
    
    processed = processed.map(gf => {
      const coords = gf.polygon_coords ? (typeof gf.polygon_coords === 'string' ? JSON.parse(gf.polygon_coords) : gf.polygon_coords) : [];
      const animalsInside = animals.filter(a => !!a.latitude && isPointInPolygon({ latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude) }, coords)).length;
      const perimeter = calculatePerimeter(coords);
      return { ...gf, animalsInside, perimeter };
    });

    if (search) {
      processed = processed.filter(gf => gf.name?.toLowerCase().includes(search.toLowerCase()));
    }
    if (filterType !== 'all') {
      processed = processed.filter(gf => gf.zone_type === filterType);
    }
    
    return processed.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'newest') return b.id - a.id;
      if (sortBy === 'animals') return b.animalsInside - a.animalsInside;
      return 0;
    });
  };

  const handleDelete = (id, name) => {
    Alert.alert(
      'Supprimer la zone',
      `Voulez-vous vraiment supprimer "${name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteGeofence(id) }
      ]
    );
  };

  const renderZoneItem = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.zoneInfo}>
            <Text style={styles.zoneName}>{item.name}</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{item.zone_type || 'Grazing'}</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={styles.actionIcon} 
              onPress={() => navigation.navigate('Geofence', { editId: item.id })}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.warning} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionIcon} 
              onPress={() => handleDelete(item.id, item.name)}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{item.animalsInside}</Text>
            <Text style={styles.statLab}>Animaux</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{(item.perimeter / 1000).toFixed(1)}km</Text>
            <Text style={styles.statLab}>Périmètre</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success }} />
              <Text style={styles.statVal}>OK</Text>
            </View>
            <Text style={styles.statLab}>Statut</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Zones</Text>
            <Text style={styles.subtitle}>Gestion des périmètres</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Geofence')}>
            <Ionicons name="add" size={28} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une zone..."
            placeholderTextColor={COLORS.textDim}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity 
          style={[styles.filterBtn, filterType !== 'all' && styles.activeFilter]}
          onPress={() => setFilterType(filterType === 'all' ? 'grazing' : 'all')}
        >
          <Ionicons name="filter" size={20} color={filterType !== 'all' ? COLORS.primary : COLORS.textMuted} />
        </TouchableOpacity>
      </View>

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
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="layers-off-outline" size={64} color={COLORS.textDim} />
              <Text style={styles.emptyTitle}>Aucune zone</Text>
              <Text style={styles.emptySubtitle}>Commencez par créer votre premier périmètre de sécurité.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Geofence')}>
                <Text style={styles.emptyBtnText}>Créer une Zone</Text>
              </TouchableOpacity>
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
  
  addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOWS.soft },
  
  searchRow: { flexDirection: 'row', gap: 10, marginTop: 10, paddingHorizontal: 20, marginBottom: 15 },
  searchBar: { flex: 1, height: 48, backgroundColor: COLORS.card, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, marginLeft: 10, color: COLORS.text, fontSize: 14, fontWeight: '600' },
  filterBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  activeFilter: { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary },

  list: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  zoneInfo: { flex: 1 },
  zoneName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: COLORS.primary + '15', marginTop: 6 },
  typeText: { fontSize: 10, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase' },

  statsGrid: { flexDirection: 'row', marginTop: 20, paddingVertical: 15, borderTopWidth: 1, borderColor: COLORS.divider, gap: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  statLab: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 20, backgroundColor: COLORS.divider, alignSelf: 'center' },

  cardActions: { flexDirection: 'row', gap: 8 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 20 },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 10 },
  emptyBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.primary },
  emptyBtnText: { color: COLORS.white, fontWeight: '800' },
});
