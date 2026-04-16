import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAnimalStore from '../store/animalStore';

import theme, { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../config/theme';

export default function AnimalSettingsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { animal } = route.params;
  const { updateAnimal, isLoading } = useAnimalStore();

  const [form, setForm] = useState({
    minTemp:     String(animal.settings?.min_temp || 37.5),
    maxTemp:     String(animal.settings?.max_temp || 40.0),
    minActivity: String(animal.settings?.min_activity || 20),
    maxActivity: String(animal.settings?.max_activity || 80),
    minHeartRate: String(animal.settings?.min_heart_rate || 40),
    maxHeartRate: String(animal.settings?.max_heart_rate || 110),
  });

  const handleSave = async () => {
    try {
      await updateAnimal(animal.id, {
        settings: {
          min_temp:     parseFloat(form.minTemp),
          max_temp:     parseFloat(form.maxTemp),
          min_activity: parseInt(form.minActivity),
          max_activity: parseInt(form.maxActivity),
          min_heart_rate: parseInt(form.minHeartRate),
          max_heart_rate: parseInt(form.maxHeartRate),
        }
      });
      Alert.alert('Succès', 'Seuils mis à jour avec succès.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update thresholds.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Threshold Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.infoBox}>
          <Text style={styles.animalName}>🐄 {animal.name}</Text>
          <Text style={styles.infoText}>Configure custom safety limits for this animal. Alerts will trigger if sensors detect values outside these ranges.</Text>
        </View>

        {/* Temperature Thresholds */}
        <Text style={styles.sectionTitle}>Body Temperature (°C)</Text>
        <View style={styles.row}>
          <View style={styles.inputBox}>
            <Text style={styles.label}>Min Temp</Text>
            <TextInput
              style={styles.input}
              value={form.minTemp}
              onChangeText={(t) => setForm({ ...form, minTemp: t })}
              keyboardType="decimal-pad"
              placeholder="37.5"
              placeholderTextColor={COLORS.subtext}
            />
          </View>
          <View style={[styles.inputBox, styles.rightBox]}>
            <Text style={styles.label}>Max Temp</Text>
            <TextInput
              style={styles.input}
              value={form.maxTemp}
              onChangeText={(t) => setForm({ ...form, maxTemp: t })}
              keyboardType="decimal-pad"
              placeholder="40.0"
              placeholderTextColor={COLORS.subtext}
            />
          </View>
        </View>

        {/* Activity Thresholds */}
        <Text style={styles.sectionTitle}>Niveau d'Activité (%)</Text>
        <View style={styles.row}>
          <View style={styles.inputBox}>
            <Text style={styles.label}>Activité Min</Text>
            <TextInput
              style={styles.input}
              value={form.minActivity}
              onChangeText={(t) => setForm({ ...form, minActivity: t })}
              keyboardType="number-pad"
              placeholder="20"
              placeholderTextColor={COLORS.textDim}
            />
          </View>
          <View style={[styles.inputBox, styles.rightBox]}>
            <Text style={styles.label}>Activité Max</Text>
            <TextInput
              style={styles.input}
              value={form.maxActivity}
              onChangeText={(t) => setForm({ ...form, maxActivity: t })}
              keyboardType="number-pad"
              placeholder="80"
              placeholderTextColor={COLORS.textDim}
            />
          </View>
        </View>

        {/* Heart Rate Thresholds */}
        <Text style={styles.sectionTitle}>Rythme Cardiaque (BPM)</Text>
        <View style={styles.row}>
          <View style={styles.inputBox}>
            <Text style={styles.label}>BPM Min</Text>
            <TextInput
              style={styles.input}
              value={form.minHeartRate}
              onChangeText={(t) => setForm({ ...form, minHeartRate: t })}
              keyboardType="number-pad"
              placeholder="40"
              placeholderTextColor={COLORS.textDim}
            />
          </View>
          <View style={[styles.inputBox, styles.rightBox]}>
            <Text style={styles.label}>BPM Max</Text>
            <TextInput
              style={styles.input}
              value={form.maxHeartRate}
              onChangeText={(t) => setForm({ ...form, maxHeartRate: t })}
              keyboardType="number-pad"
              placeholder="110"
              placeholderTextColor={COLORS.textDim}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Configuration</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.surface },
  backBtn:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginLeft: 16 },
  
  scroll:    { padding: 20, paddingBottom: 40 },
  infoBox:   { backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: COLORS.border },
  animalName: { color: COLORS.primary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  infoText:  { color: COLORS.subtext, fontSize: 13, lineHeight: 20 },

  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 12, marginLeft: 4 },
  row: { flexDirection: 'row', marginBottom: 30 },
  inputBox: { flex: 1 },
  rightBox: { marginLeft: 16 },
  label: { color: COLORS.subtext, fontSize: 12, fontWeight: '600', marginBottom: 8, marginLeft: 12 },
  input: { 
    height: 56, backgroundColor: COLORS.card, borderRadius: 16, 
    paddingHorizontal: 20, color: COLORS.text, fontSize: 16, fontWeight: '600',
    borderWidth: 1, borderColor: COLORS.border 
  },

  saveBtn: { 
    height: 60, backgroundColor: COLORS.primary, borderRadius: 18, 
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10 
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
