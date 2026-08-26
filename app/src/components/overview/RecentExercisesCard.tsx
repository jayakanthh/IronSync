// components/overview/RecentExercisesCard.tsx
//
// Lists the user's most recently performed exercises. Tapping a row expands
// it in place into full history + a volume/sets chart (ExerciseHistoryDetail).
//
// TODO - CONFIRM AGAINST YOUR BACKEND:
// Assumes `getRecentExercisesForUser(userId, limit)` returning one entry per
// distinct exercise, most-recent-first, e.g.:
//   { exerciseId, exerciseName, lastPerformedAt, lastSummary }
// where lastSummary is something like "3 sets x 8 @ 60kg" for the row
// subtitle. If your data shape differs, this is the one function to adapt -
// everything downstream (the expand/collapse, ExerciseHistoryDetail) just
// needs exerciseId + exerciseName.

import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { colors, spacing } from '../../theme/colors';
import { ChevronRight, ChevronDown } from 'lucide-react-native';
import ExerciseHistoryDetail from './ExerciseHistoryDetail';
import { getRecentExercisesForUser } from '../../services/exercises/exercises';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface RecentExerciseRow {
  exerciseId: string;
  exerciseName: string;
  lastPerformedAt: number;
  lastSummary?: string;
}

interface Props {
  userId: string;
  limit?: number;
}

export default function RecentExercisesCard({ userId, limit = 8 }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RecentExerciseRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getRecentExercisesForUser(userId, limit);
        if (!active) return;
        setRows(data);
      } catch (err) {
        console.error(err);
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [userId, limit]);

  const toggle = (id: string) => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (_) {}
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <Card style={styles.card}>
      <Typography variant="bodyBold" style={styles.cardTitle}>RECENT EXERCISES</Typography>

      {!loading && rows.length === 0 && (
        <Typography variant="caption" color={colors.textMuted} style={styles.empty}>
          No recent exercises yet.
        </Typography>
      )}

      <View style={styles.list}>
        {rows.map(row => {
          const isExpanded = expandedId === row.exerciseId;
          return (
            <View key={row.exerciseId} style={styles.item}>
              <TouchableOpacity style={styles.row} onPress={() => toggle(row.exerciseId)}>
                <View style={styles.rowContent}>
                  <Typography variant="bodyBold">{row.exerciseName}</Typography>
                  {!!row.lastSummary && (
                    <Typography variant="caption" color={colors.textMuted}>{row.lastSummary}</Typography>
                  )}
                </View>
                {isExpanded ? (
                  <ChevronDown size={18} color={colors.textMuted} />
                ) : (
                  <ChevronRight size={18} color={colors.textMuted} />
                )}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.detailWrap}>
                  <ExerciseHistoryDetail userId={userId} exerciseId={row.exerciseId} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  empty: {
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  list: {
    marginTop: spacing.xs,
  },
  item: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowContent: {
    flex: 1,
  },
  detailWrap: {
    paddingBottom: spacing.md,
  },
});