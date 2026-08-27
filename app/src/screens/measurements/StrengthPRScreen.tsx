import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { X, Award, Flame, TrendingUp } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../../theme/colors';
import { useCurrentUser } from '../../context/CurrentUser';
import { getPersonalRecords } from '../../services/workouts/workouts';
import { getExercisesByIds } from '../../services/exercises/exercises';
import type { PersonalRecord, Exercise } from '../../models/index';
import {
  getUnitSystem,
  convertWeightToDisplay,
  getWeightUnit
} from '../../utils/formatting/units';

export default function StrengthPRScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { profile } = useCurrentUser();
  const system = getUnitSystem(profile);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [exercisesMap, setExercisesMap] = useState<Record<string, Exercise>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      try {
        const prList = await getPersonalRecords(profile.id);
        const uniqueIds = Array.from(new Set(prList.map(pr => pr.exerciseId)));
        const exList = await getExercisesByIds(uniqueIds);
        
        // Map exerciseId -> Exercise for name lookups
        const map: Record<string, Exercise> = {};
        exList.forEach((ex) => {
          map[ex.id] = ex;
        });

        // Sort PRs by date achieved descending
        const sortedPrs = prList.sort((a, b) => b.achievedOn.localeCompare(a.achievedOn));

        setExercisesMap(map);
        setPrs(sortedPrs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile]);

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Strength PRs</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Award size={22} color={colors.milestone} />
          <Text style={styles.title}>Strength PRs</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={prs}
        keyExtractor={(item) => item.exerciseId}
        renderItem={({ item }) => {
          const ex = exercisesMap[item.exerciseId];
          const name = ex ? ex.name : 'Unknown Exercise';
          const muscle = ex ? ex.muscleGroup : '';
          
          return (
            <View style={styles.prCard}>
              <View style={styles.cardLeft}>
                <Text style={styles.exName}>{name}</Text>
                <Text style={styles.exMuscle}>{muscle.toUpperCase()}</Text>
                <Text style={styles.prDate}>Achieved on {item.achievedOn}</Text>
              </View>
              <View style={styles.cardRight}>
                <View style={styles.metricRow}>
                  <Flame size={14} color={colors.primary} />
                  <Text style={styles.metricText}>
                    {convertWeightToDisplay(item.bestWeightKg, system).toFixed(1)} {getWeightUnit(system)} × {item.bestReps}
                  </Text>
                </View>
                <View style={styles.e1rmRow}>
                  <TrendingUp size={12} color={colors.textMuted} />
                  <Text style={styles.e1rmLabel}>Est. 1RM:</Text>
                  <Text style={styles.e1rmValue}>{convertWeightToDisplay(item.estimated1RM, system).toFixed(1)} {getWeightUnit(system)}</Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Award size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No personal records recorded yet. Complete workouts to beat PRs!</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 4 },
  list: { padding: spacing.md, paddingBottom: 40, gap: spacing.sm },
  prCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardLeft: { flex: 1, gap: 2 },
  exName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  exMuscle: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  prDate: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  e1rmRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  e1rmLabel: { color: colors.textMuted, fontSize: 11 },
  e1rmValue: { color: colors.text, fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', padding: spacing.xl, marginTop: 40, gap: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
