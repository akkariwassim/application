import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, RefreshControl,
  ScrollView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import theme, { COLORS, SHADOWS } from '../config/theme';

export default function BackupSyncScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentFarm } = useAuthStore();
  
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBackups = async () => {
    try {
      const { data } = await api.get('/api/backups');
      setBackups(data);
    } catch (err) {
      console.error('Fetch backups failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    Alert.prompt(
      'Nouvelle Sauvegarde',
      'Donnez un nom à votre sauvegarde point de restauration :',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Créer',
          onPress: async (name) => {
            setActionLoading(true);
            try {
              await api.post('/api/backups', { name });
              Alert.alert('Succès ✅', 'Point de restauration créé sur le cloud.');
              fetchBackups();
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de créer la sauvegarde.');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleRestore = (backupId, backupName) => {
    Alert.alert(
      'Restaurer les données',
      `ATTENTION: Restaurer "${backupName}" remplacera TOUTES les données actuelles de la ferme. Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Restaurer',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.post(`/api/backups/${backupId}/restore`);
              Alert.alert('Succès ✅', 'La ferme a été restaurée avec succès.');
              fetchBackups();
            } catch (err) {
              Alert.alert('Erreur', 'La restauration a échoué.');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDelete = (backupId) => {
    Alert.alert(
      'Supprimer la sauvegarde',
      'Voulez-vous supprimer ce point de restauration ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/backups/${backupId}`);
              fetchBackups();
            } catch (err) {
              Alert.alert('Erreur', 'Suppression échouée.');
            }
          }
        }
      ]
    );
  };

  const renderBackup = ({ item }) => (
    <View style={styles.backupCard}>
      <View style={[styles.typeIcon, { backgroundColor: item.type === 'manual' ? COLORS.primary + '22' : COLORS.success + '22' }]}>
        <MaterialCommunityIcons 
          name={item.type === 'manual' ? 'fingerprint' : 'calendar-clock'} 
          size={24} 
          color={item.type === 'manual' ? COLORS.primary : COLORS.success} 
        />
      </View>
      <View style={styles.backupInfo}>
        <Text style={styles.backupName}>{item.name}</Text>
        <Text style={styles.backupDate}>
          {new Date(item.created_at).toLocaleString('fr-FR')} • {(item.size_bytes / 1024).toFixed(1)} KB
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: item.status === 'restored' ? COLORS.warning : COLORS.success }]} />
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleRestore(item.id, item.name)}>
          <Ionicons name="refresh-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Cloud Backup & Sync</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchBackups} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.statusCard}>
          <View style={styles.syncHeader}>
            <Text style={styles.syncTitle}>État de Synchronisation</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN LIGNE</Text>
            </View>
          </View>
          
          <View style={styles.syncRow}>
            <View style={styles.syncItem}>
              <Text style={styles.syncValue}>{backups.length}</Text>
              <Text style={styles.syncLabel}>Sauvegardes</Text>
            </View>
            <View style={styles.syncDivider} />
            <View style={styles.syncItem}>
              <Text style={styles.syncValue}>100%</Text>
              <Text style={styles.syncLabel}>Santé Cloud</Text>
            </View>
            <View style={styles.syncDivider} />
            <View style={styles.syncItem}>
              <Ionicons name="cloud-done" size={24} color={COLORS.success} />
              <Text style={styles.syncLabel}>À jour</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.backupNowBtn} 
            onPress={handleCreateBackup}
            disabled={actionLoading}
          >
            {actionLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.backupNowText}>Sauvegarder Maintenant</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Points de Restauration</Text>
        
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={backups}
            renderItem={renderBackup}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="cloud-offline-outline" size={64} color={COLORS.border} />
                <Text style={styles.emptyText}>Aucune sauvegarde disponible.</Text>
              </View>
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  title: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  
  scrollContent: { padding: 16 },
  
  statusCard: { backgroundColor: COLORS.card, borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft },
  syncHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  syncTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.success + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  liveText: { color: COLORS.success, fontSize: 10, fontWeight: '900' },
  
  syncRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 24 },
  syncItem: { alignItems: 'center', flex: 1 },
  syncValue: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  syncLabel: { color: COLORS.textDim, fontSize: 12, fontWeight: '600', marginTop: 4 },
  syncDivider: { width: 1, height: 30, backgroundColor: COLORS.border },
  
  backupNowBtn: { backgroundColor: COLORS.primary, height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...SHADOWS.soft },
  backupNowText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  
  sectionTitle: { color: COLORS.textMuted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, marginLeft: 8 },
  
  backupCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  typeIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backupInfo: { flex: 1, marginLeft: 16 },
  backupName: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  backupDate: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: COLORS.textDim, fontSize: 10, fontWeight: '800' },
  
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { padding: 4 },
  
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.textDim, marginTop: 16, fontSize: 15, fontWeight: '600' },
});
