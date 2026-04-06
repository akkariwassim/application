import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Switch,
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
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconBox, { backgroundColor: (danger ? COLORS.danger : COLORS.primary) + '22' }]}>
        <Ionicons name={icon} size={20} color={danger ? COLORS.danger : COLORS.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: COLORS.danger }]}>{label}</Text>
      <View style={styles.menuRight}>
        {value && <Text style={styles.menuValue}>{value}</Text>}
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
  const { user, logout } = useAuthStore();
  const [notifications, setNotifications] = React.useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.scroll}>
      {/* Profile Hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.userName}>{user?.name || 'Farmer'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: user?.role === 'admin' ? COLORS.danger + '22' : COLORS.primary + '22' }]}>
          <Text style={[styles.roleText, { color: user?.role === 'admin' ? COLORS.danger : COLORS.primary }]}>
            {user?.role?.toUpperCase() || 'FARMER'}
          </Text>
        </View>
      </View>

      {/* Account Section */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.section}>
        <MenuItem icon="mail-outline"   label="Email"   value={user?.email} onPress={() => {}} />
        <MenuItem icon="call-outline"   label="Phone"   value={user?.phone || 'Not set'} onPress={() => {}} />
        <MenuItem icon="key-outline"    label="Change Password" onPress={() => Alert.alert('Coming Soon', 'Password change will be available soon.')} />
      </View>

      {/* Notifications */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.section}>
        <MenuItem
          icon="notifications-outline"
          label="Push Notifications"
          toggle toggleValue={notifications}
          onToggle={(v) => setNotifications(v)}
        />
        <MenuItem icon="warning-outline"   label="Geofence Breach Alerts" toggle toggleValue={true} onToggle={() => {}} />
        <MenuItem icon="cloud-outline"     label="Device Offline Alerts"  toggle toggleValue={true} onToggle={() => {}} />
      </View>

      {/* App */}
      <Text style={styles.sectionTitle}>App</Text>
      <View style={styles.section}>
        <MenuItem icon="information-circle-outline" label="Version" value="1.0.0" onPress={() => {}} />
        <MenuItem icon="document-text-outline"      label="Terms of Service" onPress={() => {}} />
        <MenuItem icon="shield-outline"             label="Privacy Policy"   onPress={() => {}} />
      </View>

      {/* Sign Out */}
      <View style={[styles.section, { marginTop: 8 }]}>
        <MenuItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger />
      </View>

      <Text style={styles.footer}>Smart Fence System © 2024</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:COLORS.background },
  scroll:      { paddingBottom:40 },
  hero:        { alignItems:'center', padding:28 },
  avatar:      { width:88, height:88, borderRadius:44, backgroundColor:COLORS.primary+'22', alignItems:'center', justifyContent:'center', marginBottom:12 },
  userName:    { color:COLORS.text, fontSize:22, fontWeight:'800' },
  userEmail:   { color:COLORS.subtext, fontSize:14, marginTop:4 },
  roleBadge:   { marginTop:10, paddingHorizontal:14, paddingVertical:5, borderRadius:12 },
  roleText:    { fontSize:12, fontWeight:'700', letterSpacing:1 },
  sectionTitle:{ color:COLORS.subtext, fontSize:12, fontWeight:'700', textTransform:'uppercase', letterSpacing:1, marginHorizontal:20, marginBottom:8, marginTop:20 },
  section:     { backgroundColor:COLORS.card, marginHorizontal:16, borderRadius:16, borderWidth:1, borderColor:COLORS.border, overflow:'hidden' },
  menuItem:    { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderColor:COLORS.border },
  menuIconBox: { width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', marginRight:12 },
  menuLabel:   { flex:1, color:COLORS.text, fontSize:15 },
  menuRight:   { flexDirection:'row', alignItems:'center', gap:8 },
  menuValue:   { color:COLORS.subtext, fontSize:13 },
  footer:      { textAlign:'center', color:COLORS.subtext, fontSize:12, marginTop:32 },
});
