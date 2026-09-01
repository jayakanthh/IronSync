import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play } from 'lucide-react-native';
import { useTheme } from '../../theme/colors';

/**
 * Floating "Start New Workout" pill, shown on Home & Workouts. Tapping it starts
 * straight away — the caller wires onPress to startWorkout() (default plan, or a
 * free workout if none). Rendered absolutely so it floats above the tab bar.
 */
export default function StartWorkoutButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // Sit just above the (absolute, overlaid) tab bar: its ~49pt bar + bottom inset.
  const bottom = insets.bottom + 58;
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <Play size={20} color={theme.colors.primaryForeground} fill={theme.colors.primaryForeground} />
        <Text style={[styles.text, { color: theme.colors.primaryForeground }]}>Start New Workout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 999,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: { fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
