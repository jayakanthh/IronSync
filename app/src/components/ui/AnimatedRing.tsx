import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A progress arc that sweeps to its value instead of appearing at it.
 *
 * Animating an SVG prop rules out the native driver, which is fine here: it's
 * a handful of circles, not a list.
 */
export default function AnimatedRing({
  cx,
  cy,
  r,
  color,
  strokeWidth,
  progress,
  duration = 800,
  delay = 0,
}: {
  cx: number;
  cy: number;
  r: number;
  color: string;
  strokeWidth: number;
  /** 0–1. Clamped, so overeating doesn't wrap the ring past full. */
  progress: number;
  duration?: number;
  delay?: number;
}) {
  const circumference = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;
  const target = Math.max(0, Math.min(1, progress || 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [target, duration, delay, anim]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeDasharray={circumference}
      strokeDashoffset={strokeDashoffset}
      strokeLinecap="round"
    />
  );
}
