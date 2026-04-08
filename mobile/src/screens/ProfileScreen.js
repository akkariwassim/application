import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Switch, Modal, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../store/authStore';

const COLORS = {
  primary:'#4F46E5', background:'#0A0F1E', surface:'#131929',
  card:'#1E2A45', text:'#F0F4FF', subtext:'#94A3B8',
  danger:'#EF4444', border:'rgba(255,255,255,0.08)', safe:'#22C55E',
};

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
  const [notifications, setNotifications] = useState(true);
  
  // Modals state
  const [nameModal, setNameModal] = useState(false);
  const [pwdModal, setPwdModal] = useState(false);
  const [phoneModal, setPhoneModal] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [newName, setNewName] = useState(user?.name || '');
  const [newPhone, setNewPhone] = useState(user?.phone || '');
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' });

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
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.scroll}>
      
      {/* Profile Hero */}
      <View style={styles.hero}>
        <TouchableOpacity style={styles.avatar} onPress={() => setNameModal(true)}>
          <Ionicons name="person" size={40} color={COLORS.primary} />
          <View style={styles.editBadge}>
            <Ionicons name="pencil" size={12} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: user?.role === 'admin' ? COLORS.danger + '22' : COLORS.primary + '22' }]}>
          <Text style={[styles.roleText, { color: user?.role === 'admin' ? COLORS.danger : COLORS.primary }]}>
            {user?.role?.toUpperCase() || 'FERMIER'}
          </Text>
        </View>
      </View>

      {/* Account Section */}
      <Text style={styles.sectionTitle}>Compte</Text>
      <View style={styles.section}>
        <MenuItem 
          icon="person-outline" 
          label="Nom complet" 
          value={user?.name} 
          onPress={() => {
            setNewName(user?.name || '');
            setNameModal(true);
          }} 
        />
        <MenuItem 
          icon="mail-outline"   
          label="Email"   
          value={user?.email} 
          onPress={() => {
            setNewEmail(user?.email || '');
            setEmailModal(true);
          }} 
        />
        <MenuItem 
          icon="call-outline"   
          label="Téléphone" 
          value={user?.phone || 'Ajouter votre numéro'} 
          onPress={() => {
            setNewPhone(user?.phone || '');
            setPhoneModal(true);
          }} 
        />
        <MenuItem icon="key-outline"    label="Changer le mot de passe" onPress={() => setPwdModal(true)} />
      </View>

      {/* Notifications */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.section}>
        <MenuItem
          icon="notifications-outline"
          label="Notifications Push"
          toggle toggleValue={notifications}
          onToggle={(v) => setNotifications(v)}
        />
        <MenuItem icon="warning-outline"   label="Alertes de clôture" toggle toggleValue={true} onToggle={() => {}} />
      </View>

      {/* Sign Out */}
      <View style={[styles.section, { marginTop: 24 }]}>
        <MenuItem icon="log-out-outline" label="Se déconnecter" onPress={handleLogout} danger />
      </View>

      <Text style={styles.footer}>Smart Fence System © 2024</Text>

      {/* MODAL: Update Name */}
      <Modal visible={nameModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modifier le nom</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Votre nom"
              placeholderTextColor={COLORS.subtext}
              autoFocus
            />
            {error && <Text style={styles.modalError}>{error}</Text>}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setNameModal(false); clearError(); }}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={onUpdateName} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL: Update Phone */}
      <Modal visible={phoneModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modifier le téléphone</Text>
            <TextInput
              style={styles.modalInput}
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="Ex: 0612345678"
              placeholderTextColor={COLORS.subtext}
              keyboardType="phone-pad"
              autoFocus
            />
            {error && <Text style={styles.modalError}>{error}</Text>}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setPhoneModal(false); clearError(); }}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={onUpdatePhone} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL: Update Email */}
      <Modal visible={emailModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modifier l'email</Text>
            <TextInput
              style={styles.modalInput}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="votre@email.com"
              placeholderTextColor={COLORS.subtext}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            {error && <Text style={styles.modalError}>{error}</Text>}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEmailModal(false); clearError(); }}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={onUpdateEmail} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL: Change Password */}
      <Modal visible={pwdModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Changer le mot de passe</Text>
            
            <Text style={styles.inputLabel}>Ancien mot de passe</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              value={pwdForm.current}
              onChangeText={(t) => setPwdForm({...pwdForm, current: t})}
            />
            
            <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              value={pwdForm.new}
              onChangeText={(t) => setPwdForm({...pwdForm, new: t})}
            />

            <Text style={styles.inputLabel}>Confirmer le nouveau</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              value={pwdForm.confirm}
              onChangeText={(t) => setPwdForm({...pwdForm, confirm: t})}
            />

            {error && <Text style={styles.modalError}>{error}</Text>}
            
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setPwdModal(false); clearError(); }}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={onChangePassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Changer</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:COLORS.background },
  scroll:      { paddingBottom:40 },
  hero:        { alignItems:'center', padding:28 },
  avatar:      { width:88, height:88, borderRadius:44, backgroundColor:COLORS.primary+'22', alignItems:'center', justifyContent:'center', marginBottom:12, position:'relative' },
  editBadge:   { position:'absolute', bottom:0, right:0, backgroundColor:COLORS.primary, width:24, height:24, borderRadius:12, alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:COLORS.background },
  userName:    { color:COLORS.text, fontSize:22, fontWeight:'800' },
  userEmail:   { color:COLORS.subtext, fontSize:14, marginTop:4 },
  roleBadge:   { marginTop:10, paddingHorizontal:14, paddingVertical:5, borderRadius:12 },
  roleText:    { fontSize:12, fontWeight:'700', letterSpacing:1 },
  sectionTitle:{ color:COLORS.subtext, fontSize:12, fontWeight:'700', textTransform:'uppercase', letterSpacing:1, marginHorizontal:20, marginBottom:8, marginTop:20 },
  section:     { backgroundColor:COLORS.card, marginHorizontal:16, borderRadius:16, borderWidth:1, borderColor:COLORS.border, overflow:'hidden' },
  menuItem:    { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderColor:COLORS.border },
  menuIconBox: { width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', marginRight:12 },
  menuLabel:   { flex:1, color:COLORS.text, fontSize:15 },
  menuRight:   { flexDirection:'row', alignItems:'center', gap:8, maxWidth:'50%' },
  menuValue:   { color:COLORS.subtext, fontSize:13 },
  footer:      { textAlign:'center', color:COLORS.subtext, fontSize:12, marginTop:40 },

  // Modal styles
  modalOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', padding:20 },
  modalCard:   { backgroundColor:COLORS.card, borderRadius:24, padding:24, borderWidth:1, borderColor:COLORS.border },
  modalTitle:  { color:COLORS.text, fontSize:18, fontWeight:'700', marginBottom:20 },
  inputLabel:  { color:COLORS.subtext, fontSize:12, marginBottom:6, marginTop:12 },
  modalInput:  { backgroundColor:COLORS.surface, borderRadius:12, height:48, color:COLORS.text, paddingHorizontal:16, borderWidth:1, borderColor:COLORS.border },
  modalError:  { color:COLORS.danger, fontSize:13, marginTop:12 },
  modalBtns:   { flexDirection:'row', justifyContent:'flex-end', marginTop:24, gap:12 },
  cancelBtn:   { paddingVertical:10, paddingHorizontal:16 },
  cancelBtnText:{ color:COLORS.subtext, fontSize:15, fontWeight:'600' },
  saveBtn:     { backgroundColor:COLORS.primary, borderRadius:12, paddingVertical:10, paddingHorizontal:20, minWidth:100, alignItems:'center' },
  saveBtnText: { color:'#fff', fontSize:15, fontWeight:'700' },
});

