import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../theme/colors';
import { TAB_BAR_SPACE } from '../../theme/layout';
import { useCurrentUser } from '../../context/CurrentUser';
import { SimpleHeader } from '../../components/ui/SimpleHeader';
import ProgressGraph from '../../components/ui/ProgressGraph';
import { getGoals, getMeasurementHistory, updateGoal } from '../../services/measurements/measurements';
import {
  getUnitSystem,
  convertWeightToDisplay,
  getWeightUnit,
  convertCmToDisplay,
  getMeasurementUnit,
} from '../../utils/formatting/units';
import { calculateBMR, calculateTDEE, generateCalorieRecommendation } from '../../services/measurements/energy';
import { analyzeProgress } from '../../services/measurements/trend';
import { setNutritionTargets, getNutritionTargets } from '../../services/nutrition/nutrition';
import type { MeasurementGoal, MeasurementEntry } from '../../models/measurement';

export default function GoalDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { profile } = useCurrentUser();
  const goalId: string = route.params?.goalId;

  const [goal, setGoal] = useState<MeasurementGoal | null>(null);
  const [weights, setWeights] = useState<MeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const allGoals = await getGoals(profile.id);
    // If this goal was replaced (createGoal pauses the old one when you change
    // your target), show the goal that's actually active now rather than a
    // paused one the user has moved on from.
    const requested = allGoals.find((g) => g.id === goalId);
    const found =
      requested && requested.status !== 'active'
        ? allGoals.find((g) => g.status === 'active') ?? requested
        : requested;
    if (found) {
      setGoal(found);
      const mHistory = await getMeasurementHistory(profile.id, found.measurementType);
      setWeights(mHistory);
    }
    setLoading(false);
  }, [profile, goalId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !profile || !goal) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Energy ───────────────────────────────────────────────────────────────
  let tdee = 0;
  if (profile.gender && profile.weightKg && profile.heightCm && profile.age && profile.activityLevel) {
    const bmr = calculateBMR(profile.gender, profile.weightKg, profile.heightCm, profile.age);
    tdee = calculateTDEE(bmr, profile.activityLevel);
  }

  const durationDays = Math.max(
    1,
    (goal.targetDate - goal.startDate) / (1000 * 60 * 60 * 24),
  );
  const recommendation = generateCalorieRecommendation(
    tdee,
    goal.startValue,
    goal.targetValue,
    durationDays,
  );

  // ── Trend analysis ────────────────────────────────────────────────────────
  const trendResult = analyzeProgress(
    weights,
    goal.startValue,
    goal.targetValue,
    goal.startDate,
    goal.targetDate,
  );

  // ── Estimated completion ──────────────────────────────────────────────────
  const targetDateStr = new Date(goal.targetDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const estimatedDateStr = trendResult.estimatedCompletionDate
    ? new Date(trendResult.estimatedCompletionDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  // ── Nutrition integration ─────────────────────────────────────────────────
  const applyNutrition = async () => {
    if (!recommendation.calories) return;
    const current = await getNutritionTargets(profile.id);
    Alert.alert(
      'Apply to Nutrition',
      `Update your daily target from ${
        current?.dailyCalories ?? 'not set'
      } kcal to ${recommendation.calories} kcal?`,
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            await setNutritionTargets(profile.id, {
              dailyCalories: recommendation.calories!,
              proteinG: current?.proteinG ?? 150,
              carbsG: current?.carbsG ?? 200,
              fatG: current?.fatG ?? 60,
              fiberG: current?.fiberG ?? Math.round((recommendation.calories! / 1000) * 14),
            });
            Alert.alert('Updated', 'Your nutrition target has been updated.');
          },
        },
      ],
    );
  };

  const handleEndGoal = async () => {
    Alert.alert('End Goal', 'Mark this goal as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Goal',
        style: 'destructive',
        onPress: async () => {
          await updateGoal(profile.id, goal.id, { status: 'completed' });
          navigation.goBack();
        },
      },
    ]);
  };

  const system = getUnitSystem(profile);

  const formatGoalValue = (val: number, goalUnit: string, measurementType: string) => {
    if (goalUnit === 'kg' || measurementType === 'weight') {
      return convertWeightToDisplay(val, system);
    } else if (goalUnit === 'cm') {
      return convertCmToDisplay(val, system);
    }
    return val;
  };

  const getGoalUnitLabel = (goalUnit: string, measurementType: string) => {
    if (goalUnit === 'kg' || measurementType === 'weight') {
      return getWeightUnit(system);
    } else if (goalUnit === 'cm') {
      return getMeasurementUnit(system);
    }
    return goalUnit;
  };

  const formatGoalValueStr = (val: number, goalUnit: string, measurementType: string) => {
    const converted = formatGoalValue(val, goalUnit, measurementType);
    if (goalUnit === 'kg' || measurementType === 'weight') {
      return converted.toFixed(1);
    } else if (goalUnit === 'cm') {
      return converted.toFixed(2);
    }
    return converted.toString();
  };

  const displayUnit = getGoalUnitLabel(goal.unit, goal.measurementType);
  const displayTarget = formatGoalValue(goal.targetValue, goal.unit, goal.measurementType);

  const displayRawPoints = trendResult.rawPoints.map(p => ({
    ...p,
    value: formatGoalValue(p.value, goal.unit, goal.measurementType)
  }));
  const displayTrendPoints = trendResult.trendPoints.map(p => ({
    ...p,
    value: formatGoalValue(p.value, goal.unit, goal.measurementType)
  }));
  const displayProjection = trendResult.projection.map(p => ({
    ...p,
    expected: formatGoalValue(p.expected, goal.unit, goal.measurementType)
  }));

  const displayCurrentTrend = trendResult.currentTrend !== null
    ? formatGoalValue(trendResult.currentTrend, goal.unit, goal.measurementType)
    : null;
  const displayExpectedNow = trendResult.expectedNow !== null
    ? formatGoalValue(trendResult.expectedNow, goal.unit, goal.measurementType)
    : null;

  return (
    <View style={styles.screen}>
      <SimpleHeader title="Goal Details" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Goal header */}
        <View style={styles.goalHeader}>
          <Text style={styles.goalType}>
            {goal.type.replace(/_/g, ' ').toUpperCase()}
          </Text>
          <Text style={styles.targetText}>
            {`${formatGoalValueStr(goal.startValue, goal.unit, goal.measurementType)} → ${formatGoalValueStr(goal.targetValue, goal.unit, goal.measurementType)} ${displayUnit}`}
          </Text>
          <Text style={[styles.statusLabel, { color: trendResult.statusColor }]}>
            {trendResult.statusLabel}
          </Text>
        </View>

        {/* Actual vs Expected vs Target graph */}
        <ProgressGraph
          rawPoints={displayRawPoints}
          trendPoints={displayTrendPoints}
          projection={displayProjection}
          targetValue={displayTarget}
          height={220}
          showTimeFilter={true}
          unit={displayUnit}
        />

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {displayCurrentTrend !== null
                ? `${displayCurrentTrend.toFixed(1)} ${displayUnit}`
                : '—'}
            </Text>
            <Text style={styles.statLabel}>Current Trend</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {displayExpectedNow !== null
                ? `${displayExpectedNow.toFixed(1)} ${displayUnit}`
                : '—'}
            </Text>
            <Text style={styles.statLabel}>Expected Now</Text>
          </View>
        </View>

        {/* Dates row */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>TIMELINE</Text>
          <View style={styles.dateRow}>
            <View>
              <Text style={styles.dateLabel}>Target Date</Text>
              <Text style={styles.dateValue}>{targetDateStr}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.dateLabel}>Estimated Completion</Text>
              <Text style={[styles.dateValue, { color: estimatedDateStr ? colors.primary : colors.textMuted }]}>
                {estimatedDateStr ?? 'Not enough data'}
              </Text>
            </View>
          </View>
          {trendResult.daysAheadOrBehind !== null && (
            <Text
              style={[
                styles.daysNote,
                {
                  color:
                    trendResult.daysAheadOrBehind >= 0 ? colors.primary : colors.danger,
                },
              ]}
            >
              {trendResult.daysAheadOrBehind >= 0
                ? `${trendResult.daysAheadOrBehind} day(s) ahead of schedule`
                : `${Math.abs(trendResult.daysAheadOrBehind)} day(s) behind schedule`}
            </Text>
          )}
        </View>

        {/* Calorie recommendation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ENERGY RECOMMENDATION</Text>
          {recommendation.calories ? (
            <>
              <Text style={styles.recCalories}>
                {recommendation.calories} kcal / day
              </Text>
              <Text
                style={[
                  styles.recStatus,
                  {
                    color:
                      recommendation.status === 'recommended'
                        ? colors.primary
                        : recommendation.status === 'aggressive'
                        ? colors.milestone
                        : colors.danger,
                  },
                ]}
              >
                {recommendation.status.charAt(0).toUpperCase() +
                  recommendation.status.slice(1)}
              </Text>
              {recommendation.warning && (
                <Text style={styles.warningText}>{recommendation.warning}</Text>
              )}
              <TouchableOpacity style={styles.applyBtn} onPress={applyNutrition}>
                <Text style={styles.applyBtnText}>Apply to Nutrition</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.warningText}>{recommendation.warning}</Text>
          )}
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={() =>
            navigation.navigate('GoalSetup', {
              prefill: {
                startValue: goal.startValue,
                targetValue: goal.targetValue,
                // What's left of the original window, so a half-finished goal
                // doesn't reset to six weeks.
                days: Math.max(
                  7,
                  Math.round((goal.targetDate - Date.now()) / (24 * 60 * 60 * 1000)),
                ),
              },
            })
          }
        >
          <Text style={styles.outlineBtnText}>Edit Goal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerBtn} onPress={handleEndGoal}>
          <Text style={styles.dangerBtnText}>End Goal</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: TAB_BAR_SPACE },

  goalHeader: { alignItems: 'center', marginBottom: spacing.sm },
  goalType: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  targetText: { color: colors.text, fontSize: 28, fontWeight: '800', marginVertical: 6 },
  statusLabel: { fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 4 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dateLabel: { color: colors.textMuted, fontSize: 12 },
  dateValue: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  daysNote: { fontSize: 12, marginTop: spacing.sm, fontWeight: '600' },

  recCalories: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 2 },
  recStatus: { fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
  applyBtn: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  applyBtnText: { color: colors.primaryDark, fontWeight: '700' },
  warningText: { color: colors.danger, fontSize: 13, lineHeight: 19 },

  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  outlineBtnText: { color: colors.text, fontWeight: '600' },
  dangerBtn: {
    borderWidth: 1,
    borderColor: '#402020',
    backgroundColor: '#1a0808',
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#f87171', fontWeight: '600' },
});