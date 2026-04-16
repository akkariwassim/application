import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../config/theme';

const HealthWidget = ({ title, value, unit, icon, color, subValue, pulse = false }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pulse) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pulse]);

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Ionicons name={icon} size={22} color={color} />
        </Animated.View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          {unit && <Text style={styles.unit}>{unit}</Text>}
        </View>
        {subValue && <Text style={styles.subValue}>{subValue}</Text>}
      </View>
      
      {/* Subtle indicator light */}
      <View style={[styles.indicator, { backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  value: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
  },
  unit: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  subValue: {
    color: COLORS.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  indicator: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  }
});

export default HealthWidget;
