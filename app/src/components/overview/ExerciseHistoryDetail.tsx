// components/overview/ExerciseHistoryDetail.tsx
//
// Rendered inside RecentExercisesCard when a row is expanded. Shows the
// full session history for one exercise plus the Monthly/Yearly chart.
//
// TODO - CONFIRM AGAINST YOUR BACKEND:
// Assumes `getExerciseHistoryForUser(userId, exerciseId)` returning every
// session the user logged for that exercise, most-recent-first:
//   { date, sets, volume, topSet?: { weight, reps } }
// `volume` should be sum(weight * reps) across that session's sets, and
// `sets` the number of sets. If your workout documents store raw sets
// instead of a precomputed summary, add a small mapper before this
// component rather than inside it, so this stays a pure display component.

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Typography } from '../ui/Typography';
import { colors, spacing } from '../../theme/colors';
import VolumeSetsChart, { ExerciseSessionLike } from './VolumeSetsChart';
// TODO: point this at your real per-exercise history service.
import { getExerciseHistoryForUser } from '../../services/exercises/exercises';

interface Session extends ExerciseSessionLike {
  topSet?: { weight: number; reps: number };
}

interface Props {
  userId: string;
  exerciseId: string;
}

export default function ExerciseHistoryDetail({ userId, exerciseId }: Props) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getExerciseHistoryForUser(userId, exerciseId);
        if (!active) return;
        setSessions(data);
      } catch (err) {
        console.error(err);
        if (active) setSessions([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [userId, exerciseId]);

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />;
  }

  if (sessions.length === 0) {
    return (
      <Typography variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
        No history yet for this exercise.
      </Typography>
    );
  }

  return (
    <View>
      <VolumeSetsChart sessions={sessions} />

      <View style={styles.historyList}>
        {sessions.slice(0, 6).map((s, i) => (
          <View key={i} style={styles.historyRow}>
            <Typography variant="caption" color={colors.textMuted} style={styles.historyDate}>
              {new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Typography>
            <Typography variant="caption" style={styles.historyMid}>
              {s.sets} {s.sets === 1 ? 'set' : 'sets'}
              {s.topSet ? `  ·  top ${s.topSet.weight}kg x ${s.topSet.reps}` : ''}
            </Typography>
            <Typography variant="bodyBold" color={colors.primary}>
              {Math.round(s.volume)} kg
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  historyList: {
    marginTop: spacing.sm,
    gap: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDate: {
    width: 56,
  },
  historyMid: {
    flex: 1,
  },
});