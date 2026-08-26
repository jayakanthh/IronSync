// components/overview/MuscleHeatmapCard.tsx
//
// Self-contained card: month picker + front/back muscle heatmap for the
// signed-in user. Drop this into OverviewTab's return - it fetches its own
// data and does not touch any existing state/effects on that screen.
//
// TODO - CONFIRM AGAINST YOUR BACKEND:
// This assumes a `getUserWorkoutsInRange(userId, startMs, endMs)` service
// function that returns the user's own workouts (with `entries: {
// exerciseId, sets }[]`) for a date range - the per-user equivalent of the
// `getCommunityWorkouts` you already use for the community feed. If your
// service layer instead exposes something like `getUserWorkouts(userId,
// limit)` (all workouts, no date filtering), swap the import below and
// filter client-side the same way `aggregateMuscleSets` already does
// internally (it ignores anything outside [startMs, endMs] regardless).

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { colors, spacing } from '../../theme/colors';
import BodyMuscleDiagram from './BodyMuscleDiagram';
import MonthSelector, { MonthOption, buildRecentMonths } from './MonthSelector';
import { aggregateMuscleSets, normalizeIntensities, getMonthRange, WorkoutLike } from '../../utils/muscleHeatmap';
import { emptyMuscleSetCounts } from '../../types/muscle';
import { getExercisesByIds } from '../../services/exercises/exercises';
// TODO: point this at your real per-user workout fetch (see note above).
import { getUserWorkoutsInRange } from '../../services/workouts/workouts';

interface Props {
  userId: string;
}

export default function MuscleHeatmapCard({ userId }: Props) {
  const initialMonth = buildRecentMonths(1)[0];
  const [selectedMonth, setSelectedMonth] = useState<MonthOption>(initialMonth);
  const [loading, setLoading] = useState(true);
  const [setCounts, setSetCounts] = useState(emptyMuscleSetCounts());

  const load = useCallback(async (month: MonthOption) => {
    setLoading(true);
    try {
      const { startMs, endMs } = getMonthRange(month.year, month.monthIndex0);
      const workouts: WorkoutLike[] = await getUserWorkoutsInRange(userId, startMs, endMs);

      const uniqueExIds = new Set<string>();
      workouts.forEach(w => w.entries.forEach(e => uniqueExIds.add(e.exerciseId)));
      const exList = await getExercisesByIds(Array.from(uniqueExIds));
      const exerciseMap = new Map(exList.map(e => [e.id, e]));

      const counts = aggregateMuscleSets(workouts, exerciseMap, startMs, endMs);
      setSetCounts(counts);
    } catch (err) {
      console.error(err);
      setSetCounts(emptyMuscleSetCounts());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    load(selectedMonth).then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, load]);

  const intensities = normalizeIntensities(setCounts);

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Typography variant="bodyBold" style={styles.cardTitle}>MUSCLES WORKED</Typography>
      </View>

      <MonthSelector selected={selectedMonth} onSelect={setSelectedMonth} />

      <View style={styles.diagramWrap}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : (
          <BodyMuscleDiagram intensities={intensities} setCounts={setCounts} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
  diagramWrap: {
    marginTop: spacing.sm,
    minHeight: 220,
  },
});