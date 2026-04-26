import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../config/theme';
import useSimulationStore from '../store/simulationStore';
import useAnimalStore from '../store/animalStore';

const { width } = Dimensions.get('window');

const SCENARIO_CARDS = [
  { id: 'normal',   label: 'Normal',   icon: 'checkmark-circle-outline', color: '#10B981', desc: 'Comportement standard' },
  { id: 'sleeping', label: 'Repos',    icon: 'moon-outline',         color: '#6366F1', desc: 'Activité minimale' },
  { id: 'running',  label: 'Course',   icon: 'speedometer-outline',  color: '#F59E0B', desc: 'Mouvement rapide' },
  { id: 'stress',   label: 'Stress',   icon: 'pulse',                color: '#EC4899', desc: 'Rythme cardiaque élevé' },
  { id: 'sick',     label: 'Malade',   icon: 'thermometer-outline',  color: '#EF4444', desc: 'Fièvre détectée' },
  { id: 'escaped',  label: 'Évadé',    icon: 'exit-outline',         color: '#F43F5E', desc: 'Hors zone virtuelle' },
  { id: 'offline',  label: 'Offline',  icon: 'cloud-offline-outline',color: '#64748B', desc: 'Perte de connexion' },
];

export default function SimulationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { 
    isSimulationMode, toggleSimulationMode, 
    activeScenario, setScenario, 
    selectedAnimalId, setSelectedAnimal,
    simulatedData, logs 
  } = useSimulationStore();
  
  const { animals } = useAnimalStore();

  React.useEffect(() => {
    if (!selectedAnimalId && animals.length > 0) {
      setSelectedAnimal(animals[0].id);
    }
  }, [animals, selectedAnimalId]);

  const handleToggle = (val) => {
    toggleSimulationMode(val);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mode Simulation</Text>
          <Text style={styles.subtitle}>Test virtuel sans matériel IOT</Text>
        </View>
        <Switch
          value={isSimulationMode}
          onValueChange={handleToggle}
          trackColor={{ false: '#1E293B', true: COLORS.primary + '80' }}
          thumbColor={isSimulationMode ? COLORS.primary : '#94A3B8'}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* -- Mode Selection -- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Sélection de l'Animal</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.animalList}>
            {animals.map(animal => (
              <TouchableOpacity
                key={animal.id}
                style={[
                  styles.animalCard, 
                  selectedAnimalId === animal.id && styles.animalCardActive
                ]}
                onPress={() => setSelectedAnimal(animal.id)}
              >
                <View style={[styles.animalIcon, { backgroundColor: selectedAnimalId === animal.id ? COLORS.primary : '#1E293B' }]}>
                  <MaterialCommunityIcons 
                    name={animal.type === 'equine' ? 'horse-variant' : animal.type === 'bovine' ? 'cow' : 'sheep'} 
                    size={20} 
                    color="#fff" 
                  />
                </View>
                <Text style={[styles.animalName, selectedAnimalId === animal.id && styles.textWhite]}>{animal.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* -- Scenarios -- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Scénarios de Test</Text>
          <View style={styles.grid}>
            {SCENARIO_CARDS.map(card => (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.scenarioCard,
                  activeScenario === card.id && { borderColor: card.color, backgroundColor: card.color + '10' }
                ]}
                onPress={() => setScenario(card.id)}
              >
                <View style={[styles.scenarioIcon, { backgroundColor: card.color + '20' }]}>
                  <Ionicons name={card.icon} size={24} color={card.color} />
                </View>
                <Text style={styles.scenarioLabel}>{card.label}</Text>
                <Text style={styles.scenarioDesc}>{card.desc}</Text>
                {activeScenario === card.id && (
                  <View style={[styles.activeDot, { backgroundColor: card.color }]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* -- Live Monitoring -- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Monitoring en Direct</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TEMPÉRATURE</Text>
              <Text style={styles.statValue}>{simulatedData.temperature || '--'}°C</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>CARDIAQUE</Text>
              <Text style={styles.statValue}>{simulatedData.heart_rate || '--'} BPM</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ACTIVITÉ</Text>
              <Text style={styles.statValue}>{simulatedData.activity || '--'}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>VITESSE</Text>
              <Text style={styles.statValue}>{simulatedData.speed || '--'} km/h</Text>
            </View>
          </View>
        </View>

        {/* -- Logs -- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Journal d'Événements</Text>
          <View style={styles.logContainer}>
            {logs.length === 0 ? (
              <Text style={styles.emptyLogs}>Aucun événement enregistré...</Text>
            ) : (
              logs.map(log => (
                <View key={log.id} style={styles.logLine}>
                  <Text style={styles.logTime}>[{log.time}]</Text>
                  <Text style={styles.logMsg}>{log.msg}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {isSimulationMode && (
          <TouchableOpacity 
            style={styles.mapShortcut}
            onPress={() => navigation.navigate('Map')}
          >
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.mapShortcutText}>Voir sur la Carte</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: COLORS.subtext, fontSize: 13 },
  scrollContent: { padding: 20 },
  section: { marginBottom: 25 },
  sectionTitle: { color: COLORS.subtext, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 15, textTransform: 'uppercase' },
  
  animalList: { flexDirection: 'row', marginBottom: 5 },
  animalCard: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 16,
    marginRight: 12,
    width: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  animalCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  animalIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  animalName: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  textWhite: { color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  scenarioCard: {
    width: (width - 52) / 2,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  scenarioIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  scenarioLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  scenarioDesc: { color: COLORS.subtext, fontSize: 11 },
  activeDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    width: (width - 50) / 2,
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: { color: COLORS.subtext, fontSize: 10, fontWeight: '700', marginBottom: 5 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  logContainer: {
    backgroundColor: '#05070A',
    borderRadius: 16,
    padding: 15,
    minHeight: 150,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  logLine: { flexDirection: 'row', marginBottom: 8 },
  logTime: { color: COLORS.primary, fontSize: 11, fontWeight: '700', width: 70 },
  logMsg: { color: '#94A3B8', fontSize: 11, flex: 1 },
  emptyLogs: { color: COLORS.subtext, fontSize: 12, textAlign: 'center', marginTop: 50 },

  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF444420', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 5 },
  liveText: { color: '#EF4444', fontSize: 9, fontWeight: '900' },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  mapShortcut: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    marginTop: 10,
    ...SHADOWS.soft,
  },
  mapShortcutText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
