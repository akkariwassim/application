import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ── Install global error → terminal logger FIRST, before anything else ──
import { initErrorLogger } from './src/utils/errorLogger';
initErrorLogger();

import useAuthStore from './src/store/authStore';
import useAlertStore from './src/store/alertStore';
import useAnimalStore from './src/store/animalStore';
import { connectSocket, disconnectSocket } from './src/services/socketService';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MapScreen from './src/screens/MapScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import AnimalsScreen from './src/screens/AnimalsScreen';
import AnimalDetailScreen from './src/screens/AnimalDetailScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GeofenceScreen from './src/screens/GeofenceScreen';
import ZonesListScreen from './src/screens/ZonesListScreen';
import AnimalViewScreen from './src/screens/AnimalViewScreen';
import AlertDetailScreen from './src/screens/AlertDetailScreen';
import AnimalSettingsScreen from './src/screens/AnimalSettingsScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const COLORS = {
  primary:    '#4F46E5',
  background: '#0A0F1E',
  surface:    '#131929',
  text:       '#F0F4FF',
  subtext:    '#94A3B8',
  danger:     '#EF4444',
};

// ── ErrorBoundary — catches React render errors and logs them to terminal ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const sep = '─'.repeat(60);
    // This goes straight to the Metro terminal
    console.error(
      `\n🔴 [PHONE ERROR] REACT RENDER ERROR\n${sep}\n` +
      `Message  : ${error?.message}\n` +
      `Component: ${info?.componentStack?.trim()}\n` +
      `Stack    :\n${error?.stack}\n${sep}`
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <Text style={errStyles.title}>💥 App Crashed</Text>
          <Text style={errStyles.subtitle}>Check your Metro terminal for the full error.</Text>
          <ScrollView style={errStyles.box}>
            <Text style={errStyles.msg}>{this.state.error?.message}</Text>
            <Text style={errStyles.stack}>{this.state.error?.stack}</Text>
          </ScrollView>
          <TouchableOpacity
            style={errStyles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errStyles.btnText}>↺  Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0A0F1E', padding:24, justifyContent:'center' },
  title:     { color:'#EF4444', fontSize:22, fontWeight:'800', marginBottom:8 },
  subtitle:  { color:'#94A3B8', fontSize:13, marginBottom:16 },
  box:       { backgroundColor:'#131929', borderRadius:12, padding:12, maxHeight:300, marginBottom:20 },
  msg:       { color:'#F59E0B', fontWeight:'700', fontSize:13, marginBottom:8 },
  stack:     { color:'#94A3B8', fontSize:11, fontFamily:'monospace' },
  btn:       { backgroundColor:'#4F46E5', borderRadius:12, height:48, alignItems:'center', justifyContent:'center' },
  btnText:   { color:'#fff', fontWeight:'700', fontSize:15 },
});

// ── Auth Stack ──────────────────────────────────────────────
function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"    component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// ── Animals Stack ────────────────────────────────────────────
function AnimalsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
      }}
    >
      <Stack.Screen name="AnimalsList"  component={AnimalsScreen}      options={{ title: 'My Animals' }} />
      <Stack.Screen name="AnimalView"   component={AnimalViewScreen}    options={{ title: 'Dashboard' }} />
      <Stack.Screen name="AnimalDetail" component={AnimalDetailScreen}  options={{ title: 'Animal Details' }} />
      <Stack.Screen name="AnimalSettings" component={AnimalSettingsScreen} options={{ title: 'Thresholds' }} />
      <Stack.Screen name="History"      component={HistoryScreen}       options={{ title: 'Movement History' }} />
      <Stack.Screen name="AlertDetail"  component={AlertDetailScreen}   options={{ title: 'Alert Details' }} />
    </Stack.Navigator>
  );
}

// ── Zones Stack ──────────────────────────────────────────────
function ZonesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
      }}
    >
      <Stack.Screen name="ZonesList" component={ZonesListScreen} options={{ title: 'My Zones', headerShown: false }} />
      <Stack.Screen name="Geofence"  component={GeofenceScreen}  options={{ title: 'Zone Editor' }} />
    </Stack.Navigator>
  );
}

// ── Main Tab Navigator ────────────────────────────────────────
function MainNavigator() {
  const unreadCount        = useAlertStore((s) => s.unreadCount);
  const addAlert           = useAlertStore((s) => s.addAlert);
  const updateAnimalPos    = useAnimalStore((s) => s.updateAnimalPosition);
  const updateAnimalStatus = useAnimalStore((s) => s.updateAnimalStatus);

  useEffect(() => {
    connectSocket({
      onPositionUpdate: (data) => updateAnimalPos(data.animalId, data),
      onAlertTriggered: (data) => addAlert(data),
      onStatusChange:   (data) => updateAnimalStatus(data.animalId, data.status),
    });
    return () => disconnectSocket();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Map:     focused ? 'map'          : 'map-outline',
            Zones:   focused ? 'layers'       : 'layers-outline',
            Alerts:  focused ? 'notifications': 'notifications-outline',
            Animals: focused ? 'paw'          : 'paw-outline',
            Profile: focused ? 'person'       : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.subtext,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: 'rgba(255,255,255,0.05)',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11 },
        headerStyle:      { backgroundColor: COLORS.surface },
        headerTintColor:  COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
      })}
    >
      <Tab.Screen name="Map"     component={MapScreen}      options={{ title: '🗺 Live Map', headerShown: false }} />
      <Tab.Screen name="Zones"   component={ZonesStack} options={{ title: '🛡 Zones' }} />
      <Tab.Screen name="Alerts"  component={AlertsScreen} options={{
        title: 'Alerts',
        tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        tabBarBadgeStyle: { backgroundColor: COLORS.danger },
      }} />
      <Tab.Screen name="Animals" component={AnimalsStack} options={{ title: 'Animals', headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ── Root App ────────────────────────────────────────────────
export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const init            = useAuthStore((s) => s.init);

  useEffect(() => { init(); }, []);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>🐄 Smart Fence</Text>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NavigationContainer>
            {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
