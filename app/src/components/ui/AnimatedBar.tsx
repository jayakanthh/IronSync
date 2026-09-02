import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

/**
 * A progress bar fill that grows to its value. Animating width means no native
 * driver, which is fine for the handful of bars on a screen.
 */
export default function AnimatedBar({
  percent,
  color,
  style,
  duration = 600,
  delay = 0,
}: {
  /** 0–100; clamped. */
  percent: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const target = Math.max(0, Math.min(100, percent || 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [target, duration, delay, anim]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return <Animated.View style={[style, { width, backgroundColor: color }]} />;
}
