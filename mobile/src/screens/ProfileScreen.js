import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Switch, Modal, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../store/authStore';

import theme, { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../config/theme';
import useAnimalStore from '../store/animalStore';
import useGeofenceStore from '../store/geofenceStore';

function MenuItem({ icon, label, value, onPress, danger, toggle, toggleValue, onToggle }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7} disabled={toggle}>
      <View style={[styles.menuIconBox, { backgroundColor: (danger ? COLORS.danger : COLORS.primary) + '22' }]}>
        <Ionicons name={icon} size={20} color={danger ? COLORS.danger : COLORS.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: COLORS.danger }]}>{label}</Text>
      <View style={styles.menuRight}>
        {value && <Text style={styles.menuValue} numberOfLines={1}>{value}</Text>}
        {toggle
          ? <Switch value={toggleValue} onValueChange={onToggle} trackColor={{ true: COLORS.primary }} />
          : <Ionicons name="chevron-forward" size={16} color={COLORS.subtext} />
        }
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUserProfile, error, clearError } = useAuthStore();
  const { animals } = useAnimalStore();
  const { geofences } = useGeofenceStore();
  
  const [notifications, setNotifications] = useState(true);
  
  // States
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('account'); // account, farm, security
  const [loading, setLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    farmName: user?.farm_name || '',
    farmDescription: user?.farm_description || ''
  });

  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' });

  // Compute Statistics
  const totalAnimals = animals.length;
  const totalArea = geofences.reduce((acc, gf) => acc + (gf.area_sqm || 0), 0);
  const areaDisplay = totalArea > 10000 ? `${(totalArea / 10000).toFixed(1)} ha` : `${totalArea.toLocaleString()} m²`;

  const handleUpdateProfile = async () => {
    setLoading(true);
    const success = await updateUserProfile(formData);
    setLoading(false);
    if (success) {
      setEditModalVisible(false);
      Alert.alert('Succès ✅', 'Vos informations ont été mises à jour.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: logout },
      ]
    );
  };

  const onUpdateName = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    const ok = await updateUserProfile({ name: newName });
    setLoading(false);
    if (ok) {
      setNameModal(false);
      Alert.alert('Succès', 'Votre nom a été mis à jour.');
    }
  };

  const onUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    setLoading(true);
    const ok = await updateUserProfile({ email: newEmail });
    setLoading(false);
    if (ok) {
      setEmailModal(false);
      Alert.alert('Succès', 'Votre email a été mis à jour.');
    }
  };

  const onChangePassword = async () => {
    const { current, new: n1, confirm } = pwdForm;
    if (!current || !n1 || !confirm) {
      Alert.alert('Erreur', 'Tous les champs sont obligatoires.');
      return;
    }
    if (n1 !== confirm) {
      Alert.alert('Erreur', 'Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    if (n1.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères.');
      return;
    }

    setLoading(true);
    const ok = await updateUserProfile({ 
      currentPassword: current, 
      newPassword: n1 
    });
    setLoading(false);
    if (ok) {
      setPwdModal(false);
      setPwdForm({ current: '', new: '', confirm: '' });
      Alert.alert('Succès', 'Mot de passe modifié avec succès.');
    }
  };

  const onUpdatePhone = async () => {
    if (!newPhone.trim()) return;
    setLoading(true);
    const ok = await updateUserProfile({ phone: newPhone });
    setLoading(false);
    if (ok) {
      setPhoneModal(false);
      Alert.alert('Succès', 'Votre numéro de téléphone a été mis à jour.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Hero & Farm ID ── */}
        <View style={styles.hero}>
          <TouchableOpacity style={styles.avatar} onPress={() => setEditModalVisible(true)}>
            <View style={styles.avatarInternal}>
              <Text style={styles.avatarInitial}>{user?.name?.charAt(0) || 'U'}</Text>
            </View>
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={10} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.name || 'Administrateur'}</Text>
          <View style={styles.farmPill}>
            <Ionicons name="business" size={12} color={COLORS.primary} />
            <Text style={styles.farmPillText}>{user?.farm_name || 'Ma Ferme IOT'}</Text>
          </View>
        </View>

        {/* ── Farm Dashboard Overview ── */}
        <View style={styles.dashboardCard}>
          <View style={styles.dashHeader}>
            <Text style={styles.dashTitle}>État de l'Exploitation</Text>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>SYSTÈME LIVE</Text>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.primary + '22' }]}>
                <MaterialCommunityIcons name="cow" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.statValue}>{totalAnimals}</Text>
              <Text style={styles.statLabel}>Animaux</Text>
            </View>
            <View style={styles.dividerV} />
            <View style={styles.statBox}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.success + '22' }]}>
                <Ionicons name="map" size={24} color={COLORS.success} />
              </View>
              <Text style={styles.statValue}>{areaDisplay}</Text>
              <Text style={styles.statLabel}>Surface</Text>
            </View>
            <View style={styles.dividerV} />
            <View style={styles.statBox}>
              <View style={[styles.statIcon, { backgroundColor: COLORS.warning + '22' }]}>
                <MaterialCommunityIcons name="shield-check" size={24} color={COLORS.warning} />
              </View>
              <Text style={styles.statValue}>{geofences.length}</Text>
              <Text style={styles.statLabel}>Zones</Text>
            </View>
          </View>
        </View>

        {/* ── Settings Sections ── */}
        <Text style={styles.sectionHeader}>Gestion du Compte</Text>
        <View style={styles.section}>
          <MenuItem 
            icon="person-outline" 
            label="Informations Personnelles" 
            value={user?.name} 
            onPress={() => {
              setFormData({ 
                name: user?.name || '', 
                email: user?.email || '', 
                phone: user?.phone || '',
                farmName: user?.farm_name || '',
                farmDescription: user?.farm_description || ''
              });
              setActiveTab('account');
              setEditModalVisible(true);
            }} 
          />
          <MenuItem 
            icon="business-outline" 
            label="Exploitation & Ferme" 
            value={user?.farm_name} 
            onPress={() => {
              setActiveTab('farm');
              setEditModalVisible(true);
            }} 
          />
          <MenuItem icon="lock-closed-outline" label="Sécurité & Mot de passe" onPress={() => { setActiveTab('security'); setEditModalVisible(true); }} />
        </View>

        <Text style={styles.sectionHeader}>Préférences App</Text>
        <View style={styles.section}>
          <MenuItem
            icon="notifications-outline"
            label="Notifications Smart"
            toggle toggleValue={notifications}
            onToggle={(v) => setNotifications(v)}
          />
          <MenuItem icon="color-palette-outline" label="Mode Sombre (OLED)" toggle toggleValue={true} onToggle={() => {}} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        <Text style={styles.appVersion}>Smart Fence Enterprise v2.5.0</Text>
      </ScrollView>

      {/* ── Unified Management Modal ── */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.managementCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestion Farm Cloud</Text>
              <TouchableOpacity onPress={() => { setEditModalVisible(false); clearError(); }}>
                <Ionicons name="close-circle" size={28} color={COLORS.textDim} />
              </TouchableOpacity>
            </View>

            {/* Tab Selector */}
            <View style={styles.tabRow}>
              {['account', 'farm', 'security'].map(tab => (
                <TouchableOpacity 
                  key={tab} 
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab === 'account' ? 'Profil' : tab === 'farm' ? 'Ferme' : 'Sécurité'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {activeTab === 'account' && (
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Nom complet</Text>
                  <TextInput style={styles.fieldInput} value={formData.name} onChangeText={t => setFormData({...formData, name: t})} />
                  
                  <Text style={styles.fieldLabel}>Email de contact</Text>
                  <TextInput style={styles.fieldInput} value={formData.email} keyboardType="email-address" onChangeText={t => setFormData({...formData, email: t})} />
                  
                  <Text style={styles.fieldLabel}>Téléphone Mobile</Text>
                  <TextInput style={styles.fieldInput} value={formData.phone} keyboardType="phone-pad" onChangeText={t => setFormData({...formData, phone: t})} />
                </View>
              )}

              {activeTab === 'farm' && (
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Nom de l'Exploitation</Text>
                  <TextInput style={styles.fieldInput} value={formData.farmName} placeholder="Ma Ferme" placeholderTextColor={COLORS.textDim} onChangeText={t => setFormData({...formData, farmName: t})} />
                  
                  <Text style={styles.fieldLabel}>Description / Notes</Text>
                  <TextInput 
                    style={[styles.fieldInput, { height: 80, paddingTop: 12 }]} 
                    multiline 
                    value={formData.farmDescription} 
                    placeholder="Détails de l'exploitation..."
                    placeholderTextColor={COLORS.textDim}
                    onChangeText={t => setFormData({...formData, farmDescription: t})} 
                  />
                </View>
              )}

              {activeTab === 'security' && (
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Ancien mot de passe</Text>
                  <TextInput style={styles.fieldInput} secureTextEntry value={pwdForm.current} onChangeText={t => setPwdForm({...pwdForm, current: t})} />
                  
                  <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
                  <TextInput style={styles.fieldInput} secureTextEntry value={pwdForm.new} onChangeText={t => setPwdForm({...pwdForm, new: t})} />
                  
                  <Text style={styles.fieldLabel}>Confirmer</Text>
                  <TextInput style={styles.fieldInput} secureTextEntry value={pwdForm.confirm} onChangeText={t => setPwdForm({...pwdForm, confirm: t})} />
                </View>
              )}

              {error && <Text style={styles.modalError}>{error}</Text>}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.primaryAction, { backgroundColor: activeTab === 'security' ? COLORS.primary : COLORS.success }]} 
              onPress={activeTab === 'security' ? onChangePassword : handleUpdateProfile}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryActionText}>Appliquer les modifications</Text>}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:COLORS.background },
  scroll:      { paddingBottom:60, paddingHorizontal: 16 },
  
  // Hero Section
  hero:        { alignItems:'center', paddingBottom: 24, paddingTop: 10 },
  avatar:      { width:100, height:100, borderRadius:50, backgroundColor:COLORS.card, padding: 4, ...SHADOWS.soft },
  avatarInternal: { flex: 1, borderRadius: 50, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  avatarInitial: { color: COLORS.primary, fontSize: 36, fontWeight: '800' },
  editBadge:   { position:'absolute', bottom:4, right:4, backgroundColor:COLORS.primary, width:28, height:28, borderRadius:14, alignItems:'center', justifyContent:'center', borderWidth:3, borderColor:COLORS.background },
  userName:    { color:COLORS.text, fontSize:24, fontWeight:'900', marginTop: 16 },
  farmPill:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary + '15', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  farmPillText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  // Dashboard Card
  dashboardCard: { backgroundColor: COLORS.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.soft, marginBottom: 20 },
  dashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dashTitle: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  onlineText: { color: COLORS.success, fontSize: 9, fontWeight: '900' },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statBox: { alignItems: 'center', flex: 1 },
  statIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  statLabel: { color: COLORS.textDim, fontSize: 11, fontWeight: '600', marginTop: 2 },
  dividerV: { width: 1, height: 40, backgroundColor: COLORS.border },

  sectionHeader: { color: COLORS.textMuted, fontSize: 13, fontWeight: '800', marginLeft: 10, marginBottom: 12, marginTop: 20, textTransform: 'uppercase', letterSpacing: 1 },
  section: { backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: COLORS.border },
  menuIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  menuLabel: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '600' },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuValue: { color: COLORS.textDim, fontSize: 13 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 32, paddingVertical: 18, borderRadius: 20, backgroundColor: COLORS.danger + '10', borderWidth: 1, borderColor: COLORS.danger + '20' },
  logoutText: { color: COLORS.danger, fontSize: 16, fontWeight: '800' },
  appVersion: { textAlign: 'center', color: COLORS.textDim, fontSize: 11, marginTop: 30, fontWeight: '600' },

  // Management Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  managementCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  
  tabRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  tab: { flex: 1, height: 42, borderRadius: 12, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { color: COLORS.textDim, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: COLORS.white },

  formGroup: { gap: 16 },
  fieldLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginLeft: 4 },
  fieldInput: { backgroundColor: COLORS.card, borderRadius: 14, height: 54, paddingHorizontal: 18, color: COLORS.white, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },
  
  primaryAction: { height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 32, ...SHADOWS.hard },
  primaryActionText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  modalError: { color: COLORS.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
});

