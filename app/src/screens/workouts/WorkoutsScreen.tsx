import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { Play, Plus, Dumbbell } from 'lucide-react-native';
import { colors, spacing, radius, useTheme } from '../../theme/colors';
import RoutineLibraryScreen from './RoutineLibraryScreen';
import ExerciseLibraryScreen from './ExerciseLibraryScreen';
import { getExercises, searchExercises, getMyPlans, getPublicPlans, getPlan, clonePlan, setActivePlan } from '../../services/index';
import { exerciseToView, planToRoutine } from '../../adapters/adapters';
import { promptStartWorkout } from '../../utils/startWorkout';
import { useCurrentUser } from '../../context/CurrentUser';
import type { Routine, Exercise } from '../../types/ironsync';

type SubTab = 'routines' | 'exercises';

export default function WorkoutsScreen({
  navigation,
}: {
  navigation: { navigate: (screen: string, params?: any) => void };
}) {
  const insets = useSafeAreaInsets();
  const { profile, refresh } = useCurrentUser();
  const [tab, setTab] = useState<SubTab>('routines');
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Real exercise library (loaded once on component mount)
  useEffect(() => {
    getExercises(100).then((res) => setExercises(res.data.map(exerciseToView)));
  }, []);

  // Real plans: mine (public + private) + everyone's public, de-duped.
  // The active plan (profile.activePlanId) is flagged so it shows a "Default" badge.
  const loadPlans = useCallback(async () => {
    const uid = profile?.id;
    const [mine, pub] = await Promise.all([uid ? getMyPlans(uid) : [], getPublicPlans()]);
    const byId = new Map(pub.map((p) => [p.id, p]));
    mine.forEach((p) => byId.set(p.id, p));
    const activeId = profile?.activePlanId;
    setRoutines([...byId.values()].map((p) => planToRoutine(p, false, p.id === activeId)));
  }, [profile?.id, profile?.activePlanId]);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans]),
  );

  // "Save" from Public Library → clone the plan into the user's own routines
  // so it lives under "My Routines" and is fully editable (they own the copy).
  const handleAdopt = async (routineId: string) => {
    if (!profile) return;
    try {
      const plan = await getPlan(routineId);
      if (!plan) return;
      await clonePlan(profile.id, plan, profile.displayName);
      await refresh();
      await loadPlans();
      Alert.alert('Saved', `"${plan.name}" was added to your routines. Find it under My Routines.`);
    } catch {
      Alert.alert('Error', 'Could not save this routine. Please try again.');
    }
  };

  // Set (or unset) the user's default plan — Home's "Today's Plan" follows it.
  const handleSetDefault = async (routineId: string) => {
    if (!profile) return;
    const makeDefault = profile.activePlanId !== routineId;
    // Optimistic: only one plan is the default at a time.
    setRoutines((prev) => prev.map((r) => ({ ...r, isActive: makeDefault && r.id === routineId })));
    try {
      await setActivePlan(profile.id, makeDefault ? routineId : null);
      await refresh();
    } catch {
      await loadPlans(); // revert to server truth
    }
  };

  const { theme } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/* Exercise Hub Launch Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary, fontWeight: theme.typography.headingWeight }]}>Exercise Hub</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Start training splits or log free workouts</Text>
      </View>

      {/* Start Workout — prompts Free Workout vs Follow Default Plan */}
      <TouchableOpacity
        style={[styles.startWorkoutCta, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
        activeOpacity={0.9}
        onPress={() =>
          promptStartWorkout(profile, (params) => navigation.navigate('LogWorkout', params))
        }
      >
        <View style={styles.ctaContent}>
          <Play size={20} color={theme.colors.primaryForeground} fill={theme.colors.primaryForeground} />
          <Text style={[styles.startWorkoutText, { color: theme.colors.primaryForeground }]}>Start Workout</Text>
        </View>
      </TouchableOpacity>

      {/* Selector Tabs */}
      <View style={[styles.segmentWrap, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.segment, tab === 'routines' && [styles.segmentActive, { backgroundColor: theme.colors.primary }]]}
          onPress={() => setTab('routines')}
        >
          <Text style={[styles.segmentText, { color: tab === 'routines' ? theme.colors.primaryForeground : theme.colors.textSecondary }]}>ROUTINES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === 'exercises' && [styles.segmentActive, { backgroundColor: theme.colors.primary }]]}
          onPress={() => setTab('exercises')}
        >
          <Text style={[styles.segmentText, { color: tab === 'exercises' ? theme.colors.primaryForeground : theme.colors.textSecondary }]}>EXERCISES</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Screen Content */}
      <View style={{ flex: 1 }}>
        {tab === 'routines' ? (
          <RoutineLibraryScreen
            routines={routines}
            currentUserName={profile?.displayName}
            onStartRoutine={(r: Routine) => {
              if (r.creator === profile?.displayName) {
                // Preloads routine exercises into LogWorkout logger
                navigation.navigate('LogWorkout', {
                  exercises: r.exercises.map((ex) => ({
                    exerciseId: ex.exerciseId,
                    name: ex.name,
                    targetSets: ex.sets,
                    targetReps: parseInt(ex.reps) || 10,
                  })),
                  sourceLabel: r.name,
                });
              } else {
                // Public plan → adopt first
                navigation.navigate('AdoptPlan', { planId: r.id });
              }
            }}
            onSaveRoutineToggle={handleAdopt}
            onSetDefault={handleSetDefault}
            onCreateRoutineClick={() => navigation.navigate('PlanBuilder')}
            onEditRoutine={(r: Routine) => navigation.navigate('PlanBuilder', { planId: r.id })}
          />
        ) : (
          <ExerciseLibraryScreen
            exercises={exercises}
            onSelectExercise={(e: Exercise) => {
              // Launches same LogWorkout logger preloaded with selected exercise
              navigation.navigate('LogWorkout', {
                exercises: [{ exerciseId: e.id, name: e.name, targetSets: e.defaultSets || 3, targetReps: parseInt(e.defaultReps) || 10 }],
                sourceLabel: e.name,
              });
            }}
            onSearchChange={(q: string) => {
              if (q.trim().length >= 2) {
                searchExercises(q.trim(), 100).then(res => setExercises(res.map(exerciseToView)));
              } else if (q.trim().length === 0) {
                getExercises(100).then(res => setExercises(res.data.map(exerciseToView)));
              }
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 2 },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  headerSubtitle: { color: colors.textMuted, fontSize: 13 },
  
  startWorkoutCta: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  startWorkoutText: { color: colors.primaryDark, fontSize: 16, fontWeight: '900' },

  segmentWrap: {
    flexDirection: 'row',
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  segmentTextActive: { color: colors.primaryDark },
});