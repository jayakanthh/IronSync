import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Calendar, Clock, TrendingUp, Zap, Award } from 'lucide-react-native';
import { colors, spacing, radius } from '../../theme/colors';
import { getWorkoutById, getExercisesByIds, getPublicProfile } from '../../services/index';
import type { Workout, Exercise, User } from '../../models/index';
import MuscleSilhouette, { aggregateMusclesFromExercises } from '../../components/common/MuscleSilhouette';

export default function WorkoutDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const { workoutId, userId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [userProfile, setUserProfile] = useState<{ displayName: string } | null>(null);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [musclePrimary, setMusclePrimary] = useState<Set<string>>(new Set());
  const [muscleSecondary, setMuscleSecondary] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      if (!workoutId || !userId) {
        setLoading(false);
        return;
      }
      try {
        const [wkt, pub] = await Promise.all([
          getWorkoutById(userId, workoutId),
          // Only your own profile document is readable; everyone else's name
          // comes from their public copy.
          getPublicProfile(userId),
        ]);
        const u = pub ? { displayName: pub.displayName } : null;

        if (wkt) {
          setWorkout(wkt);
          setUserProfile(u);

          const exIds = wkt.entries.map((e) => e.exerciseId);
          if (exIds.length > 0) {
            const exList = await getExercisesByIds(exIds);
            const exMap: Record<string, Exercise> = {};
            exList.forEach((e) => {
              exMap[e.id] = e;
            });
            setExercises(exMap);

            const { primary, secondary } = aggregateMusclesFromExercises(exList);
            setMusclePrimary(primary);
            setMuscleSecondary(secondary);
          }
        }
      } catch (e) {
        console.error('Error loading workout details', e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [workoutId, userId]);

  const totalVolume = useMemo(() => {
    if (!workout) return 0;
    return workout.entries.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + (set.weightKg || 0) * (set.reps || 0), 0), 0);
  }, [workout]);

  const totalSets = useMemo(() => {
    if (!workout) return 0;
    return workout.entries.reduce((sum, e) => sum + e.sets.length, 0);
  }, [workout]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Workout details not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{workout.planName || 'Workout Details'}</Text>
          <Text style={styles.headerSubtitle}>
            Logged by {userProfile?.displayName || 'User'}
          </Text>
          {workout.workoutType === 'duo' && workout.duoPartnerName && (
            <View style={styles.duoBadge}>
              <Text style={styles.duoBadgeText}>🤝 Duo with {workout.duoPartnerName}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date Row */}
        <View style={styles.metaRow}>
          <Calendar size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {new Date(workout.createdAt || workout.date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Clock size={16} color={colors.primary} />
            <Text style={styles.statVal}>{workout.durationMinutes ? `${workout.durationMinutes} min` : '—'}</Text>
            <Text style={styles.statLbl}>Duration</Text>
          </View>
          <View style={styles.statCard}>
            <Zap size={16} color={colors.primary} />
            <Text style={styles.statVal}>{totalVolume.toLocaleString()} kg</Text>
            <Text style={styles.statLbl}>Volume</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={16} color={colors.primary} />
            <Text style={styles.statVal}>{totalSets}</Text>
            <Text style={styles.statLbl}>Total Sets</Text>
          </View>
        </View>

        {/* Muscle Visualization Card */}
        <View style={styles.muscleContainerCard}>
          <Text style={styles.muscleSectionHeader}>MUSCLES WORKED</Text>
          <View style={styles.bodyVizRow}>
            <View style={styles.bodyVizItem}>
              <Text style={styles.bodyVizLabel}>ANTERIOR (FRONT)</Text>
              <MuscleSilhouette primaryMuscles={musclePrimary} secondaryMuscles={muscleSecondary} view="front" size={130} />
            </View>
            <View style={styles.bodyVizItem}>
              <Text style={styles.bodyVizLabel}>POSTERIOR (BACK)</Text>
              <MuscleSilhouette primaryMuscles={musclePrimary} secondaryMuscles={muscleSecondary} view="back" size={130} />
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Primary Focus</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#166e57' }]} />
              <Text style={styles.legendText}>Secondary Helpers</Text>
            </View>
          </View>
        </View>

        {/* Exercises Performed */}
        <Text style={styles.sectionLabel}>EXERCISES PERFORMED</Text>
        {workout.entries.map((entry, idx) => {
          const ex = exercises[entry.exerciseId];
          const name = ex?.name || 'Exercise';
          return (
            <View key={entry.exerciseId} style={styles.exerciseCard}>
              <View style={styles.exHeader}>
                <View style={styles.exIconCircle}>
                  <Text style={styles.exIconText}>{(ex?.muscleGroup || '?').slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{name}</Text>
                  <Text style={styles.exMuscle}>{ex?.muscleGroup || 'Strength'} • {ex?.equipment || 'Bodyweight'}</Text>
                </View>
              </View>

              <View style={styles.setRowsContainer}>
                {entry.sets.map((s, sIdx) => {
                  const label = s.setType === 'warmup' ? 'W' : s.setType === 'drop' ? 'D' : 'S';
                  const labelStyle = s.setType === 'warmup' ? styles.warmupText : s.setType === 'drop' ? styles.dropText : styles.workingText;
                  
                  return (
                    <View key={sIdx} style={styles.setRow}>
                      <Text style={[styles.setNumCol, labelStyle]}>{label}{sIdx + 1}</Text>
                      <Text style={styles.setDetailCol}>
                        {s.weightKg ? `${s.weightKg} kg` : '—'}
                      </Text>
                      <Text style={styles.setDetailCol}>
                        {s.reps ? `${s.reps} reps` : '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {workout.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Workout Notes</Text>
            <Text style={styles.notesText}>"{workout.notes}"</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 16, marginBottom: spacing.md },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { padding: spacing.xs },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: colors.textMuted, fontSize: 12 },

  content: { padding: spacing.md, gap: spacing.md },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  metaText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 4 },
  statVal: { color: colors.text, fontSize: 18, fontWeight: '900' },
  statLbl: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Muscle viz container
  muscleContainerCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  muscleSectionHeader: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  bodyVizRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.xs },
  bodyVizItem: { alignItems: 'center', gap: spacing.xs },
  bodyVizLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.text, fontSize: 11, fontWeight: '600' },

  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: spacing.sm },

  exerciseCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 12 },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(72,187,149,0.15)', alignItems: 'center', justifyContent: 'center' },
  exIconText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  exName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  exMuscle: { color: colors.textMuted, fontSize: 11, textTransform: 'capitalize' },

  setRowsContainer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 6 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  setNumCol: { width: 50, fontSize: 13, fontWeight: '700' },
  setDetailCol: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  warmupText: { color: colors.textMuted },
  dropText: { color: '#06b6d4' },
  workingText: { color: colors.primary },

  notesCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  notesTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  notesText: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  duoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  duoBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  backBtn: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  backBtnText: { color: colors.primaryDark, fontWeight: '800' }
});
