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
import useGeofenceStore from './src/store/geofenceStore';
import useThemeStore from './src/store/themeStore';
import { connectSocket, disconnectSocket } from './src/services/socketService';
import { SHADOWS } from './src/config/theme';

import { startConnectivityMonitoring, stopConnectivityMonitoring } from './src/services/connectivityService';
import SyncStatusIndicator from './src/components/SyncStatusIndicator';
import GlobalErrorBoundary from './src/components/ErrorBoundary';


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
import StatisticsScreen from './src/screens/StatisticsScreen';
import TeamManagementScreen from './src/screens/TeamManagementScreen';
import BackupSyncScreen from './src/screens/BackupSyncScreen';


const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();





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
  const { getColors } = useThemeStore();
  const COLORS = getColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen name="AnimalsList"  component={AnimalsScreen}      options={{ title: 'Animaux', headerShown: false }} />
      <Stack.Screen name="AnimalView"   component={AnimalViewScreen}    options={{ title: 'Dashboard' }} />
      <Stack.Screen name="AnimalDetail" component={AnimalDetailScreen}  options={{ title: 'Détails' }} />
      <Stack.Screen name="AnimalSettings" component={AnimalSettingsScreen} options={{ title: 'Seuils' }} />
      <Stack.Screen name="History"      component={HistoryScreen}       options={{ title: 'Historique' }} />
      <Stack.Screen name="AlertDetail"  component={AlertDetailScreen}   options={{ title: 'Alerte' }} />
    </Stack.Navigator>
  );
}

// ── Zones Stack ──────────────────────────────────────────────
function ZonesStack() {
  const { getColors } = useThemeStore();
  const COLORS = getColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen name="ZonesList" component={ZonesListScreen} options={{ title: 'Mes Zones', headerShown: false }} />
      <Stack.Screen name="Geofence"  component={GeofenceScreen}  options={{ title: 'Editeur de Zone' }} />
    </Stack.Navigator>
  );
}

// ── Profile Stack ────────────────────────────────────────────
function ProfileStack() {
  const { getColors } = useThemeStore();
  const COLORS = getColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profil', headerShown: false }} />
      <Stack.Screen name="TeamManagement" component={TeamManagementScreen} options={{ title: 'Equipe', headerShown: false }} />
      <Stack.Screen name="BackupSync" component={BackupSyncScreen} options={{ title: 'Cloud Backup', headerShown: false }} />
    </Stack.Navigator>
  );
}

// ── Main Tab Navigator ────────────────────────────────────────
function MainNavigator() {
  const { getColors } = useThemeStore();
  const COLORS = getColors();
  
  const unreadCount        = useAlertStore((s) => s.unreadCount);

  const updateAnimalStatus = useAnimalStore((s) => s.updateAnimalStatus);
  const updateZoneStatus   = useGeofenceStore((s) => s.updateZoneStatus);
  const setSocketConnected = useAnimalStore((s) => s.setSocketConnected);
  const updateAnimalPos    = useAnimalStore((s) => s.updateAnimalPosition);
  const batchUpdatePos    = useAnimalStore((s) => s.batchUpdatePositions);
  const addAlert           = useAlertStore((s) => s.addAlert);

  useEffect(() => {
    startConnectivityMonitoring();
    connectSocket({
      onConnect: () => setSocketConnected(true),
      onDisconnect: () => setSocketConnected(false),
      onPositionUpdate: (data) => updateAnimalPos(data.animalId, data),
      onBatchUpdate: (batch) => batchUpdatePos(batch),
      onAlertTriggered: (data) => addAlert(data),
      onStatusChange:   (data) => updateAnimalStatus(data.animalId, data.status),
      onZoneStatusChange: (data) => updateZoneStatus(data),
    });
    return () => {
      disconnectSocket();
      stopConnectivityMonitoring();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 4,
          ...SHADOWS.soft,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          if (route.name === 'Map')        iconName = focused ? 'map'          : 'map-outline';
          else if (route.name === 'Zones') iconName = focused ? 'layers'       : 'layers-outline';
          else if (route.name === 'Alerts') iconName = focused ? 'notifications': 'notifications-outline';
          else if (route.name === 'Animals') iconName = focused ? 'paw'        : 'paw-outline';
          else if (route.name === 'Stats') iconName = focused ? 'bar-chart'    : 'bar-chart-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person'     : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map"     component={MapScreen} />
      <Tab.Screen name="Zones"   component={ZonesStack} />
      <Tab.Screen name="Stats"   component={StatisticsScreen} />
      <Tab.Screen name="Alerts"  component={AlertsScreen} options={{ tabBarBadge: unreadCount > 0 ? unreadCount : null }} />
      <Tab.Screen name="Animals" component={AnimalsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// ── Root App ────────────────────────────────────────────────
export default function App() {
  const { getColors, init: initTheme } = useThemeStore();
  const COLORS = getColors();
  
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const init            = useAuthStore((s) => s.init);

  useEffect(() => { 
    init();
  }, []);

  if (isLoading) {
    const s = styles(COLORS);
    return (
      <View style={s.splash}>
        <Text style={s.splashTitle}>🐄 Smart Fence</Text>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <GlobalErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SyncStatusIndicator />
          <NavigationContainer>
            {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </GlobalErrorBoundary>
  );
}

const styles = (COLORS) => StyleSheet.create({
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
