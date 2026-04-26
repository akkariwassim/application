import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Marker, AnimatedRegion } from 'react-native-maps';
import AnimalMarker from './AnimalMarker';

/**
 * PREMIUM: Animated Animal Marker
 * Uses AnimatedRegion for high-performance smooth transitions.
 */
const AnimatedAnimalMarker = ({ animal, onPress }) => {
  const animatedCoord = useRef(new AnimatedRegion({
    latitude: parseFloat(animal.latitude),
    longitude: parseFloat(animal.longitude),
    latitudeDelta: 0,
    longitudeDelta: 0,
  })).current;

  useEffect(() => {
    const newCoord = {
      latitude: parseFloat(animal.latitude),
      longitude: parseFloat(animal.longitude),
      duration: 1000 // Smooth move over 1 second
    };

    if (Platform.OS === 'android') {
      if (markerRef.current) {
        markerRef.current.animateMarkerToCoordinate(newCoord, 1000);
      }
    } else {
      animatedCoord.timing(newCoord).start();
    }
  }, [animal.latitude, animal.longitude]);

  const markerRef = useRef(null);

  return (
    <Marker.Animated
      ref={markerRef}
      coordinate={animatedCoord}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
    >
       <AnimalMarker animal={animal} />
    </Marker.Animated>
  );
};

export default React.memo(AnimatedAnimalMarker);
