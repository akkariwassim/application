import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, Modal, TextInput,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import theme, { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../config/theme';

const ROLES = [
  { id: 'owner', label: 'Propriétaire', icon: 'crown', color: '#F59E0B' },
  { id: 'admin', label: 'Admin Tech', icon: 'shield-check', color: '#3B82F6' },
  { id: 'worker', label: 'Ouvrier / Staff', icon: 'account-hard-hat', color: '#10B981' },
  { id: 'vet', label: 'Vétérinaire', icon: 'medical-bag', color: '#EC4899' },
];

function RoleBadge({ role }) {
  const roleInfo = ROLES.find(r => r.id === role) || ROLES[2];
  return (
    <View style={[styles.roleBadge, { backgroundColor: roleInfo.color + '22' }]}>
      <MaterialCommunityIcons name={roleInfo.icon} size={12} color={roleInfo.color} />
      <Text style={[styles.roleBadgeText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
    </View>
  );
}

export default function TeamManagementScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentFarm, user } = useAuthStore();
  
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('worker');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMembers = async () => {
    try {
      const { data } = await api.get('/api/memberships');
      setMembers(data);
    } catch (err) {
      console.error('Fetch members failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setActionLoading(true);
    try {
      await api.post('/api/memberships/invite', {
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole
      });
      setInviteModalVisible(false);
      setInviteEmail('');
      Alert.alert('Succès ✅', 'Utilisateur invité avec succès.');
      fetchMembers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erreur lors de l\'invitation.';
      Alert.alert('Erreur', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = (membershipId, memberName) => {
    Alert.alert(
      'Supprimer un membre',
      `Êtes-vous sûr de vouloir retirer ${memberName} de l'équipe ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await api.delete(`/api/memberships/${membershipId}`);
              fetchMembers();
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de supprimer le membre.');
            }
          } 
        },
      ]
    );
  };

  const renderMember = ({ item }) => {
    const isMe = item.user_id?.id === user?.id;
    const canManage = (currentFarm?.role === 'owner' || currentFarm?.role === 'admin') && !isMe;

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberAvatar}>
          <Text style={styles.avatarText}>{item.user_id?.name?.charAt(0) || '?'}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {item.user_id?.name || 'Utilisateur inconnu'} {isMe && <Text style={styles.meTag}>(Moi)</Text>}
          </Text>
          <Text style={styles.memberEmail}>{item.user_id?.email}</Text>
          <View style={styles.badgeRow}>
            <RoleBadge role={item.role} />
            {item.status === 'pending' && (
              <View style={[styles.statusBadge, { backgroundColor: COLORS.warning + '22' }]}>
                <Text style={[styles.statusBadgeText, { color: COLORS.warning }]}>PENDING</Text>
              </View>
            )}
          </View>
        </View>
        {canManage && (
          <TouchableOpacity 
            style={styles.removeBtn} 
            onPress={() => handleRemoveMember(item.id, item.user_id?.name)}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Gestion d'Équipe</Text>
        {(currentFarm?.role === 'owner' || currentFarm?.role === 'admin') ? (
          <TouchableOpacity onPress={() => setInviteModalVisible(true)} style={styles.addBtn}>
            <Ionicons name="person-add" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      <FlatList
        data={members}
        renderItem={renderMember}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} /> : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucun membre trouvé.</Text>
            </View>
          )
        }
      />

      {/* Invite Modal */}
      <Modal visible={inviteModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inviter un membre</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textDim} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Adresse Email</Text>
            <TextInput
              style={styles.input}
              placeholder="email@exemple.com"
              placeholderTextColor={COLORS.textDim}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.inputLabel}>Rôle attribué</Text>
            <View style={styles.roleSelector}>
              {ROLES.filter(r => r.id !== 'owner').map(role => (
                <TouchableOpacity
                  key={role.id}
                  style={[styles.roleItem, inviteRole === role.id && styles.roleItemActive]}
                  onPress={() => setInviteRole(role.id)}
                >
                  <MaterialCommunityIcons 
                    name={role.icon} 
                    size={20} 
                    color={inviteRole === role.id ? COLORS.white : role.color} 
                  />
                  <Text style={[styles.roleItemText, inviteRole === role.id && styles.roleItemTextActive]}>
                    {role.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.inviteBtn} 
              onPress={handleInvite}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.inviteBtnText}>Envoyer l'invitation</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  title: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '22' },
  
  list: { padding: 16 },
  memberCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  avatarText: { color: COLORS.primary, fontSize: 18, fontWeight: '800' },
  memberInfo: { flex: 1, marginLeft: 16 },
  memberName: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  meTag: { color: COLORS.primary, fontSize: 12 },
  memberEmail: { color: COLORS.textDim, fontSize: 13, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  removeBtn: { padding: 8 },

  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: COLORS.textDim, marginTop: 16, fontSize: 16, fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 24, ...SHADOWS.hard },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  inputLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: COLORS.card, borderRadius: 12, height: 50, paddingHorizontal: 16, color: COLORS.white, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  roleSelector: { gap: 10, marginBottom: 24 },
  roleItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  roleItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleItemText: { color: COLORS.text, fontWeight: '700' },
  roleItemTextActive: { color: COLORS.white },
  inviteBtn: { backgroundColor: COLORS.primary, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...SHADOWS.soft },
  inviteBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});
