import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAnimalStore from '../store/animalStore';

const COLORS = {
  primary:'#4F46E5', background:'#0A0F1E', surface:'#131929',
  card:'#1E2A45', text:'#F0F4FF', subtext:'#94A3B8',
  safe:'#22C55E', warning:'#F59E0B', danger:'#EF4444', offline:'#6B7280',
  border:'rgba(255,255,255,0.08)',
};

const STATUS_COLOR  = { safe:COLORS.safe, warning:COLORS.warning, danger:COLORS.danger, offline:COLORS.offline };
const ANIMAL_EMOJI  = { bovine:'🐄', ovine:'🐑', caprine:'🐐', equine:'🐴', other:'🐾' };

function AnimalCard({ animal, onPress, onDelete }) {
  const color = STATUS_COLOR[animal.status] || COLORS.offline;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardLeft}>
        <View style={[styles.emojiCircle, { backgroundColor: (animal.color_hex || '#4F46E5') + '33' }]}>
          <Text style={styles.emoji}>{ANIMAL_EMOJI[animal.type] || '🐾'}</Text>
        </View>
        <View>
          <Text style={styles.animalName}>{animal.name}</Text>
          <Text style={styles.animalMeta}>{animal.type} · {animal.breed || 'Unknown breed'}</Text>
          {animal.last_seen && (
            <Text style={styles.lastSeen}>Last seen: {new Date(animal.last_seen).toLocaleTimeString()}</Text>
          )}
          
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Ionicons name="thermometer" size={12} color="#FF4D4D" />
              <Text style={styles.metricText}>
                {animal.temperature ? `${parseFloat(animal.temperature).toFixed(1)}°` : '--'}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="walk" size={12} color="#4DFF88" />
              <Text style={styles.metricText}>
                {animal.activity ? `${Math.round(animal.activity)}%` : '--'}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.statusBadge, { backgroundColor: color + '22' }]}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>{animal.status}</Text>
        </View>
        <TouchableOpacity onPress={() => onDelete(animal.id, animal.name)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function AnimalsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { animals, fetchAnimals, deleteAnimal, isLoading } = useAnimalStore();

  useEffect(() => { fetchAnimals(); }, []);

  const handleDelete = (id, name) => {
    Alert.alert(
      'Delete Animal',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteAnimal(id) },
      ]
    );
  };

  const statusCounts = animals.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Animals</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AnimalDetail', { mode: 'create' })}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        {Object.entries(STATUS_COLOR).map(([s, c]) => (
          <View key={s} style={styles.statItem}>
            <Text style={[styles.statNum, { color: c }]}>{statusCounts[s] || 0}</Text>
            <Text style={styles.statLabel}>{s}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={animals}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchAnimals} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 64 }}>🐄</Text>
            <Text style={styles.emptyTitle}>No Animals Yet</Text>
            <Text style={styles.emptyText}>Tap + to add your first animal</Text>
          </View>
        }
        renderItem={({ item }) => (
          <AnimalCard
            animal={item}
            onPress={() => navigation.navigate('AnimalView', { animalId: item.id })}
            onDelete={handleDelete}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex:1, backgroundColor:COLORS.background },
  header:       { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:16 },
  title:        { fontSize:24, fontWeight:'800', color:COLORS.text, flex:1 },
  addBtn:       { width:40, height:40, borderRadius:20, backgroundColor:COLORS.primary, alignItems:'center', justifyContent:'center' },
  statsRow:     { flexDirection:'row', justifyContent:'space-around', backgroundColor:COLORS.surface, marginHorizontal:16, borderRadius:16, paddingVertical:14, marginBottom:16, borderWidth:1, borderColor:COLORS.border },
  statItem:     { alignItems:'center' },
  statNum:      { fontSize:22, fontWeight:'800' },
  statLabel:    { color:COLORS.subtext, fontSize:10, textTransform:'capitalize', marginTop:2 },
  list:         { paddingHorizontal:16, paddingBottom:40 },
  card:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:COLORS.card, borderRadius:16, padding:14, marginBottom:12, borderWidth:1, borderColor:COLORS.border },
  cardLeft:     { flexDirection:'row', alignItems:'center', gap:12, flex:1 },
  emojiCircle:  { width:48, height:48, borderRadius:24, alignItems:'center', justifyContent:'center' },
  emoji:        { fontSize:24 },
  animalName:   { color:COLORS.text, fontWeight:'700', fontSize:16 },
  animalMeta:   { color:COLORS.subtext, fontSize:12, marginTop:2 },
  lastSeen:     { color:COLORS.subtext, fontSize:10, marginTop:1 },
  metricsRow:   { flexDirection:'row', gap:10, marginTop:6 },
  metricItem:   { flexDirection:'row', alignItems:'center', gap:3 },
  metricText:   { color:COLORS.text, fontSize:11, fontWeight:'600' },
  cardRight:    { alignItems:'flex-end', gap:8 },
  statusBadge:  { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:4, borderRadius:10 },
  statusDot:    { width:6, height:6, borderRadius:3 },
  statusText:   { fontSize:11, fontWeight:'600', textTransform:'capitalize' },
  deleteBtn:    { padding:4 },
  empty:        { alignItems:'center', paddingTop:60 },
  emptyTitle:   { color:COLORS.text, fontSize:20, fontWeight:'700', marginTop:12 },
  emptyText:    { color:COLORS.subtext, marginTop:4 },
});
