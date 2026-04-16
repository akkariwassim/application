import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Marker } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../config/theme';

const AnimalMarker = ({ animal, isSelected, onPress, coordinate }) => {
  const statusColor = COLORS.status[animal.status] || COLORS.status.offline;
  
  const isStale = animal.last_sync ? (new Date() - new Date(animal.last_sync)) > 60000 : false;
  const isHealthy = (animal.temperature <= 40 && animal.heart_rate <= 100);

  const typeIcon = 
      animal.type === 'horse' ? 'horse-variant' 
    : animal.type === 'cow'   ? 'cow' 
    : animal.type === 'sheep' ? 'sheep' 
    : animal.type === 'goat'  ? 'paw' 
    : animal.type === 'camel' ? 'paw' 
    : 'paw';

  return (
    <Marker
      coordinate={coordinate || { latitude: animal.latitude, longitude: animal.longitude }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={isSelected ? 100 : 10}
      opacity={isStale ? 0.6 : 1.0}
    >
      <View style={[
        styles.container,
        { borderColor: statusColor },
        isSelected && styles.selected,
        isSelected && { shadowColor: statusColor },
        !isHealthy && { borderColor: COLORS.danger, borderWidth: 3 }
      ]}>
        {/* Pulsing indicator for abnormal heart rate or temperature */}
        {(animal.heart_rate > 100 || animal.temperature > 40) && (
          <View style={[styles.pulse, { backgroundColor: COLORS.danger }]} />
        )}
        
        <MaterialCommunityIcons 
          name={typeIcon} 
          size={isSelected ? 20 : 18} 
          color={isSelected ? COLORS.white : statusColor} 
        />
        
        {isSelected && (
          <View style={[styles.glow, { borderColor: statusColor }]} />
        )}
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  selected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.white,
    transform: [{ scale: 1.2 }],
    ...SHADOWS.hard,
  },
  glow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    opacity: 0.3,
  },
  pulse: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  }
});

export default memo(AnimalMarker);
