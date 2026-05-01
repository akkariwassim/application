import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, TextInput, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAnimalStore from '../store/animalStore';
import useThemeStore from '../store/themeStore';
import { SHADOWS } from '../config/theme';
import StatSkeleton from '../components/Skeletons/StatSkeleton';
import EmptyState from '../components/EmptyState';

const { width } = Dimensions.get('window');

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
  
  const { getColors, isDarkMode } = useThemeStore();
  const COLORS = getColors();
  const styles = createStyles(COLORS);
  
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
      "Supprimer l'animal",
      `Voulez-vous vraiment supprimer ${animal.name} ?`,
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive", 
          onPress: () => deleteAnimal(animal.id) 
        }
      ]
    );
  };

  const renderAnimalItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('AnimalView', { animal: item })}
      onLongPress={() => handleDelete(item)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: COLORS.primary + '15' }]}>
          <MaterialCommunityIcons 
            name={TYPE_ICONS[item.type?.toLowerCase()] || 'paw'} 
            size={24} 
            color={COLORS.primary} 
          />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.animalName}>{item.name}</Text>
          <Text style={styles.animalId}>ID: {item.device_id || 'N/A'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: (item.status === 'danger' ? COLORS.danger : COLORS.success) + '15' }]}>
          <View style={[styles.statusDot, { backgroundColor: item.status === 'danger' ? COLORS.danger : COLORS.success }]} />
          <Text style={[styles.statusText, { color: item.status === 'danger' ? COLORS.danger : COLORS.success }]}>
            {item.status?.toUpperCase() || 'OK'}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.stat}>
          <Ionicons name="thermometer-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.statVal}>{item.temperature || '--'}°C</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="heart-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.statVal}>{item.heart_rate || '--'} bpm</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="battery-charging" size={14} color={COLORS.textMuted} />
          <Text style={styles.statVal}>{item.battery_level || '--'}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Troupeau</Text>
            <Text style={styles.subtitle}>Gestion de l'exploitation</Text>
          </View>
          <TouchableOpacity 
            style={styles.addBtn} 
            onPress={() => navigation.navigate('Map')} // Use Map for adding or a separate form
          >
            <Ionicons name="add" size={28} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un animal..."
            placeholderTextColor={COLORS.textDim}
            value={search}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['bovine', 'ovine', 'caprine', 'equine']}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.filterChip, filters.type === item && styles.activeChip]}
              onPress={() => toggleFilter(item)}
            >
              <Text style={[styles.chipText, filters.type === item && styles.activeChipText]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        />
      </View>

      <FlatList
        data={animals}
        renderItem={renderAnimalItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListHeaderComponent={() => (
          <View style={styles.overview}>
            <View style={styles.overviewCard}>
              <Text style={styles.ovVal}>{animals.length}</Text>
              <Text style={styles.ovLab}>Total</Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={[styles.ovVal, { color: COLORS.success }]}>
                {animals.filter(a => a.status !== 'danger').length}
              </Text>
              <Text style={styles.ovLab}>Sains</Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={[styles.ovVal, { color: COLORS.danger }]}>
                {animals.filter(a => a.status === 'danger').length}
              </Text>
              <Text style={styles.ovLab}>Alertes</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState title="Aucun animal" subtitle="Commencez par ajouter vos bêtes depuis la carte." />}
      />
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
  
  searchRow: { paddingHorizontal: 20, marginTop: 15 },
  searchBar: { height: 48, backgroundColor: COLORS.card, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, marginLeft: 10, color: COLORS.text, fontSize: 14, fontWeight: '600' },

  filterRow: { marginTop: 15, marginBottom: 10 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  activeChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  activeChipText: { color: COLORS.white },

  list: { paddingHorizontal: 20, paddingBottom: 100 },
  overview: { flexDirection: 'row', gap: 12, marginBottom: 24, marginTop: 10 },
  overviewCard: { flex: 1, backgroundColor: COLORS.card, padding: 16, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft },
  ovVal: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  ovLab: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', marginTop: 4 },

  card: { backgroundColor: COLORS.card, borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerInfo: { flex: 1 },
  animalName: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  animalId: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '900' },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingVertical: 15, borderTopWidth: 1, borderColor: COLORS.divider },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statVal: { fontSize: 13, fontWeight: '700', color: COLORS.text },
});
