import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft, Dumbbell, TrendingUp } from 'lucide-react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { getExercisesByIds, getWorkoutHistory, getPersonalRecords } from '../../services/index';
import { currentUserId } from '../../services/index';
import type { Exercise, Workout, PersonalRecord } from '../../models/index';
import { convertWeightToDisplay, getWeightUnit, getUnitSystem } from '../../utils/formatting/units';
import { useCurrentUser } from '../../context/CurrentUser';
import Svg, { Polyline } from 'react-native-svg';

export default function ExerciseDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { profile } = useCurrentUser();
  const exerciseId = route.params?.exerciseId;
  const system = profile ? getUnitSystem(profile) : 'metric';

  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [pr, setPr] = useState<PersonalRecord | null>(null);
  const [history, setHistory] = useState<Workout[]>([]);
  const [isCardio, setIsCardio] = useState(false);

  useEffect(() => {
    async function load() {
      const uid = currentUserId();
      if (!uid || !exerciseId) {
        setLoading(false);
        return;
      }
      try {
        const exList = await getExercisesByIds([exerciseId]);
        if (exList.length > 0) {
          const ex = exList[0];
          setExercise(ex);
          setIsCardio(ex.category?.toLowerCase() === 'cardio' || ex.trackingType === 'duration' || ex.trackingType === 'reps_only');
        }

        const prs = await getPersonalRecords(uid);
        const myPr = prs.find(p => p.exerciseId === exerciseId);
        setPr(myPr || null);

        const wkts = await getWorkoutHistory(uid, 100);
        const filtered = wkts.filter(w => w.entries.some(e => e.exerciseId === exerciseId));
        setHistory(filtered);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [exerciseId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={[styles.container, styles.center]}>
        <Typography>Exercise not found.</Typography>
      </View>
    );
  }

  // Extract history points for graph
  const points = history.slice(0, 10).reverse().map(w => {
    const e = w.entries.find(en => en.exerciseId === exerciseId);
    if (!e || e.sets.length === 0) return 0;
    // Max weight in this workout
    return Math.max(...e.sets.map(s => s.weightKg));
  });

  const maxPt = Math.max(...points, 1);
  const minPt = Math.min(...points, 0);
  const range = maxPt - minPt;
  const svgWidth = 300;
  const svgHeight = 100;
  const polylinePoints = points.map((pt, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * svgWidth : svgWidth / 2;
    const y = range === 0 ? svgHeight / 2 : svgHeight - ((pt - minPt) / range) * svgHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Typography variant="h2">{exercise.name}</Typography>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Typography variant="bodyBold" style={styles.label}>SUMMARY STATS</Typography>
          <View style={styles.statsRow}>
            {!isCardio && (
              <View style={styles.statBox}>
                <Typography variant="caption" color={colors.textMuted}>Est. 1RM</Typography>
                <Typography variant="h2" color={colors.primary}>
                  {pr ? convertWeightToDisplay(pr.estimated1RM, system).toFixed(1) : '-'} {getWeightUnit(system)}
                </Typography>
              </View>
            )}
            <View style={styles.statBox}>
              <Typography variant="caption" color={colors.textMuted}>{isCardio ? 'Best Time/Reps' : 'Best Lift'}</Typography>
              <Typography variant="h2">
                {pr ? (isCardio ? `${pr.bestReps} reps` : `${convertWeightToDisplay(pr.bestWeightKg, system).toFixed(1)} ${getWeightUnit(system)} × ${pr.bestReps}`) : '-'}
              </Typography>
            </View>
          </View>
        </Card>

        {!isCardio && points.length > 1 && (
          <Card style={styles.card}>
            <Typography variant="bodyBold" style={styles.label}>PERFORMANCE HISTORY (MAX WEIGHT)</Typography>
            <View style={styles.graphBox}>
              <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                <Polyline points={polylinePoints} fill="none" stroke={colors.primary} strokeWidth="3" />
              </Svg>
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <Typography variant="bodyBold" style={styles.label}>RECENT WORKOUTS</Typography>
          {history.slice(0, 5).map(w => {
            const entry = w.entries.find(e => e.exerciseId === exerciseId);
            if (!entry) return null;
            return (
              <View key={w.id} style={styles.historyRow}>
                <Typography variant="bodyBold">{w.date}</Typography>
                <View style={styles.setsBox}>
                  {entry.sets.map((s, i) => (
                    <Typography key={i} variant="caption" color={colors.textMuted}>
                      Set {i + 1}: {convertWeightToDisplay(s.weightKg, system).toFixed(1)}{getWeightUnit(system)} × {s.reps}
                    </Typography>
                  ))}
                </View>
              </View>
            );
          })}
          {history.length === 0 && <Typography variant="caption">No history found.</Typography>}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingTop: 60, backgroundColor: colors.surface },
  backBtn: { padding: spacing.xs },
  scroll: { padding: spacing.md, gap: spacing.md },
  card: { padding: spacing.md },
  label: { marginBottom: spacing.sm, color: colors.textMuted, fontSize: 11, letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.surfaceAlt, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  graphBox: { alignItems: 'center', marginVertical: spacing.md },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  setsBox: { alignItems: 'flex-end' },
});
