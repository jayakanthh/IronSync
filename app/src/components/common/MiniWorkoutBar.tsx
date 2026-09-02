import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, X } from 'lucide-react-native';
import { useTheme } from '../../theme/colors';
import { useActiveWorkout } from '../../context/ActiveWorkout';

/** Height of the tab bar this sits on top of (its 49pt bar + the bottom inset). */
const TAB_BAR_BASE = 49;

/**
 * "Workout in progress" bar, shown above the tab bar once a workout has been
 * minimised. Resume goes back to the logger (which never unmounted, so nothing
 * is lost); Discard throws the session away.
 */
export default function MiniWorkoutBar() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { active, minimized, restore, discard } = useActiveWorkout();

  if (!active || !minimized) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + TAB_BAR_BASE,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={1}>
        Workout in progress
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.action}
          onPress={() => {
            restore();
            navigation.navigate('Workouts');
          }}
        >
          <Play size={18} color={theme.colors.primary} fill={theme.colors.primary} />
          <Text style={[styles.actionText, { color: theme.colors.primary }]}>Resume</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={discard}>
          <X size={18} color={theme.colors.danger} />
          <Text style={[styles.actionText, { color: theme.colors.danger }]}>Discard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 16 },
  actionText: { fontSize: 16, fontWeight: '600' },
});
