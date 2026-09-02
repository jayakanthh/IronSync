import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Dumbbell, Play, Pencil } from 'lucide-react-native';
import { spacing, radius, useTheme } from '../../theme/colors';
import { getPlan, getExercisesByIds } from '../../services/index';
import type { Plan, Exercise } from '../../models/index';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Rough working time per set, used only for the "~x min" estimate. */
const MINUTES_PER_SET = 3;

/**
 * What today's session actually holds — the screen you get before you start
 * lifting, instead of being dropped straight into an empty logger.
 *
 * A plan is a list of days, so multi-day routines get a day switcher and the
 * day matching today's weekday is picked first.
 */
export default function RoutinePreviewScreen({
  navigation,
  route,
}: {
  navigation: { goBack: () => void; navigate: (screen: string, params?: any) => void };
  route?: { params?: { planId?: string; dayIndex?: number } };
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const planId = route?.params?.planId;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [exById, setExById] = useState<Record<string, Exercise>>({});
  const [dayIndex, setDayIndex] = useState(route?.params?.dayIndex ?? 0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!planId) { setLoading(false); return; }
      try {
        const p = await getPlan(planId);
        if (cancelled || !p) { setLoading(false); return; }
        setPlan(p);

        // No day was requested → open on the day scheduled for today, if there is one.
        if (route?.params?.dayIndex == null) {
          const todayLabel = DAY_LABELS[new Date().getDay()];
          const match = p.days.findIndex((d) => d.label === todayLabel);
          setDayIndex(match >= 0 ? match : 0);
        }

        // One fetch for every exercise across every day, so switching days is instant.
        const ids = Array.from(new Set(p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))));
        const list = ids.length ? await getExercisesByIds(ids) : [];
        if (!cancelled) setExById(Object.fromEntries(list.map((e) => [e.id, e])));
      } catch (err) {
        console.error('Could not load routine preview:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planId, route?.params?.dayIndex]);

  const day = plan?.days[dayIndex];
  const totalSets = useMemo(
    () => (day?.exercises ?? []).reduce((acc, e) => acc + (e.targetSets || 0), 0),
    [day],
  );

  const handleStart = useCallback(() => {
    if (!plan || !day) return;
    navigation.navigate('LogWorkout', {
      exercises: day.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        name: exById[e.exerciseId]?.name ?? e.exerciseId,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
      })),
      sourceLabel: plan.days.length > 1 ? `${plan.name} — ${day.label}` : plan.name,
    });
  }, [plan, day, exById, navigation]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textSecondary }}>This routine could not be loaded.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: spacing.md }}>
          <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: theme.colors.surfaceElevated }]}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={18} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: theme.colors.surfaceElevated }]}
          onPress={() => navigation.navigate('PlanBuilder', { planId: plan.id })}
        >
          <Pencil size={16} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {plan.days.length > 1 ? day?.label || `Day ${dayIndex + 1}` : plan.name}
        </Text>
        {plan.days.length > 1 && (
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{plan.name}</Text>
        )}

        {/* Stats — exercises and a rough duration, nothing invented. */}
        <View style={[styles.statsRow, { borderColor: theme.colors.border }]}>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{day?.exercises.length ?? 0}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Exercises</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{totalSets}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Sets</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              ~{Math.max(1, totalSets * MINUTES_PER_SET)} min
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Time</Text>
          </View>
        </View>

        {/* Day switcher */}
        {plan.days.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <View style={styles.dayPills}>
              {plan.days.map((d, i) => (
                <TouchableOpacity
                  key={`${d.label}-${i}`}
                  style={[
                    styles.dayPill,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated },
                    i === dayIndex && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                  ]}
                  onPress={() => setDayIndex(i)}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      { color: i === dayIndex ? theme.colors.primaryForeground : theme.colors.textSecondary },
                    ]}
                  >
                    {d.label || `Day ${i + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Exercise list */}
        {(day?.exercises.length ?? 0) === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            This day has no exercises yet. Tap the pencil to add some.
          </Text>
        ) : (
          day!.exercises.map((e, i) => {
            const ex = exById[e.exerciseId];
            const image = ex?.images?.[0] ?? ex?.gifUrl ?? null;
            return (
              <TouchableOpacity
                key={`${e.exerciseId}-${i}`}
                style={styles.exRow}
                activeOpacity={0.8}
                onPress={() => ex && navigation.navigate('ExerciseDetail', { exerciseId: ex.id })}
              >
                <View style={[styles.thumb, { backgroundColor: theme.colors.surfaceElevated }]}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.thumbImg} resizeMode="cover" />
                  ) : (
                    <Dumbbell size={22} color={theme.colors.textSecondary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exName, { color: theme.colors.textPrimary }]}>
                    {(ex?.name ?? 'Exercise').toUpperCase()}
                  </Text>
                  <Text style={[styles.exMeta, { color: theme.colors.textSecondary }]}>
                    {e.targetSets} × {e.targetReps}
                    {ex?.muscleGroup ? ` · ${ex.muscleGroup}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Start bar */}
      <View style={[styles.startBar, { paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.background }]}>
        <TouchableOpacity
          style={[
            styles.startBtn,
            { backgroundColor: theme.colors.primary },
            (day?.exercises.length ?? 0) === 0 && styles.startBtnDisabled,
          ]}
          onPress={handleStart}
          disabled={(day?.exercises.length ?? 0) === 0}
        >
          <Play size={18} color={theme.colors.primaryForeground} fill={theme.colors.primaryForeground} />
          <Text style={[styles.startText, { color: theme.colors.primaryForeground }]}>Start</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { fontSize: 13, marginTop: -10 },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  statCell: { flex: 1, gap: 2 },
  statDivider: { width: 1, height: 34 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12 },
  dayPills: { flexDirection: 'row', gap: spacing.sm },
  dayPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  dayPillText: { fontSize: 12, fontWeight: '700' },
  empty: { fontSize: 13, fontStyle: 'italic', paddingVertical: spacing.lg },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 68, height: 68, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  exName: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  exMeta: { fontSize: 13, marginTop: 4 },
  startBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: 12 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: radius.lg,
  },
  startBtnDisabled: { opacity: 0.4 },
  startText: { fontSize: 17, fontWeight: '800' },
});
