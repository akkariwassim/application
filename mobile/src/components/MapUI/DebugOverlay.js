import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import useAnimalStore from '../../store/animalStore';

const DebugOverlay = ({ renderCount, apiCalls }) => {
  const animals = useAnimalStore(s => s.animals);
  const socketConnected = useAnimalStore(s => s.socketConnected);

  // This is a simple diagnostic overlay
  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.text}>SYSTEM DIAGNOSTICS</Text>
      <Text style={styles.metric}>Animals: {animals.length}</Text>
      <Text style={styles.metric}>Socket: {socketConnected ? 'CONNECTED' : 'DISCONNECTED'}</Text>
      <Text style={styles.metric}>Renders: {renderCount}</Text>
      <Text style={styles.metric}>OS: {Platform.OS.toUpperCase()}</Text>
      <Text style={[styles.metric, { color: '#2ECC71' }]}>Engine: Optimized</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 9999,
  },
  text: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: 1
  },
  metric: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  }
});

export default DebugOverlay;
