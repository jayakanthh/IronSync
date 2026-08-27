import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronRight, Activity, Target, Zap, Plus } from 'lucide-react-native';
import { colors, spacing, radius, useTheme } from '../../theme/colors';
import { useCurrentUser } from '../../context/CurrentUser';
import { getMeasurementHistory, getActiveGoal, getGoals } from '../../services/measurements/measurements';
import {
  getUnitSystem,
  convertWeightToDisplay,
  getWeightUnit,
  convertCmToDisplay,
  getMeasurementUnit,
} from '../../utils/formatting/units';
import { calculateBMR, calculateTDEE } from '../../services/measurements/energy';
import { analyzeProgress } from '../../services/measurements/trend';
import type { MeasurementEntry, MeasurementGoal, MeasurementType } from '../../models/measurement';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExpandableMeasurementCard from '../../components/measurements/ExpandableMeasurementCard';

type MeasTile = { type: MeasurementType; label: string; unit: string };

const MEASUREMENT_TILES: MeasTile[] = [
  { type: 'weight', label: 'Weight', unit: 'kg' },
  { type: 'body_fat', label: 'Body Fat', unit: '%' },
  { type: 'waist', label: 'Waist', unit: 'cm' },
  { type: 'chest', label: 'Chest', unit: 'cm' },
  { type: 'bicep', label: 'Bicep', unit: 'cm' },
  { type: 'thigh', label: 'Thigh', unit: 'cm' },
  { type: 'hips', label: 'Hips', unit: 'cm' },
  { type: 'neck', label: 'Neck', unit: 'cm' },
  { type: 'forearm', label: 'Forearm', unit: 'cm' },
  { type: 'calf', label: 'Calf', unit: 'cm' },
];

export default function MeasurementsScreen() {
  const { theme } = useTheme();
  const { profile } = useCurrentUser();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>('weight');
  const [historiesByType, setHistoriesByType] = useState<Record<string, MeasurementEntry[]>>({});
  const [goalsByType, setGoalsByType] = useState<Record<string, MeasurementGoal>>({});
  const [activeGoal, setActiveGoal] = useState<MeasurementGoal | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [allGoals, ...allData] = await Promise.all([
      getGoals(profile.id, 'active'),
      ...MEASUREMENT_TILES.map((t) => getMeasurementHistory(profile.id, t.type)),
    ]);

    const hist: Record<string, MeasurementEntry[]> = {};
    MEASUREMENT_TILES.forEach((t, i) => {
      hist[t.type] = allData[i];
    });

    const gMap: Record<string, MeasurementGoal> = {};
    allGoals.forEach((g) => {
      gMap[g.measurementType] = g;
    });

    setGoalsByType(gMap);
    setActiveGoal(allGoals.length > 0 ? allGoals[0] : null);
    setHistoriesByType(hist);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Energy ────────────────────────────────────────────────────────────────
  const hasEnergyProfile =
    profile.gender && profile.weightKg && profile.heightCm && profile.age && profile.activityLevel;

  let bmr = 0;
  let tdee = 0;
  if (hasEnergyProfile) {
    bmr = calculateBMR(
      profile.gender!,
      profile.weightKg!,
      profile.heightCm!,
      profile.age!,
    );
    tdee = calculateTDEE(bmr, profile.activityLevel!);
  }

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

  // ── Goal progress ──────────────────────────────────────────────────────────
  const goalHistory = activeGoal ? (historiesByType[activeGoal.measurementType] || []) : [];
  let trendResult = activeGoal
    ? analyzeProgress(
        goalHistory,
        activeGoal.startValue,
        activeGoal.targetValue,
        activeGoal.startDate,
        activeGoal.targetDate,
      )
    : null;

  const goalLatestEntry = goalHistory.length > 0 ? goalHistory[goalHistory.length - 1] : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Measurements</Text>
        <Text style={styles.pageSubtitle}>Body progress & goals</Text>
      </View>

      {/* Quick-action buttons */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => navigation.navigate('LogMeasurement')}
        >
          <Text style={styles.primaryActionText}>+ Log Measurements</Text>
        </TouchableOpacity>
      </View>

      {/* ── MEASUREMENTS EXPANDABLE LIST ─────────────────────────────────── */}
      <Text style={styles.sectionLabel}>BODY MEASUREMENTS & TRACKING</Text>
      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        {MEASUREMENT_TILES.map((t) => {
          const hist = historiesByType[t.type] || [];
          const goalForType = goalsByType[t.type] || (t.type === 'weight' ? activeGoal : null);
          const isExpanded = expandedType === t.type;

          return (
            <ExpandableMeasurementCard
              key={t.type}
              tile={t}
              entries={hist}
              goal={goalForType}
              system={system}
              isExpanded={isExpanded}
              onToggle={() => {
                setExpandedType((prev) => (prev === t.type ? null : t.type));
              }}
              onSetGoal={() => navigation.navigate('GoalSetup')}
            />
          );
        })}
      </View>

      {/* ── ACTIVE GOAL ───────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>ACTIVE GOAL</Text>
      {activeGoal ? (
        <TouchableOpacity
          style={styles.goalCard}
          onPress={() =>
            navigation.navigate('GoalDetails', { goalId: activeGoal.id })
          }
          activeOpacity={0.85}
        >
          <View style={styles.goalCardRow}>
            <View>
              <Text style={styles.goalCardType}>
                {activeGoal.type.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <Text style={styles.goalCardValues}>
                {`${formatGoalValueStr(activeGoal.startValue, activeGoal.unit, activeGoal.measurementType)} → ${formatGoalValueStr(activeGoal.targetValue, activeGoal.unit, activeGoal.measurementType)} ${getGoalUnitLabel(activeGoal.unit, activeGoal.measurementType)}`}
              </Text>
            </View>
            {trendResult && (
              <Text
                style={[styles.goalStatusBadge, { color: trendResult.statusColor }]}
              >
                {trendResult.statusLabel}
              </Text>
            )}
          </View>

          {/* Mini progress bar */}
          {activeGoal && (() => {
            const total = Math.abs(activeGoal.startValue - activeGoal.targetValue);
            const current = goalLatestEntry?.value ?? activeGoal.startValue;
            const done = Math.abs(activeGoal.startValue - current);
            const pct = total === 0 ? 100 : Math.min(100, (done / total) * 100);
            return (
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
              </View>
            );
          })()}

          <View style={styles.goalDateRow}>
            <Text style={styles.goalDateText}>
              Target: {new Date(activeGoal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
            {trendResult?.estimatedCompletionDate && (
              <Text style={styles.goalDateText}>
                Est: {new Date(trendResult.estimatedCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </View>

          <Text style={styles.viewGoalLink}>View Details →</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.emptyCard}>
          <Target size={24} color={colors.textMuted} />
          <Text style={styles.emptyCardText}>Set a goal to track your expected progress</Text>
          <TouchableOpacity
            style={styles.createGoalBtn}
            onPress={() => navigation.navigate('GoalSetup')}
          >
            <Text style={styles.createGoalBtnText}>Create Goal</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── ENERGY PROFILE ───────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>ENERGY PROFILE</Text>
      <View style={styles.card}>
        {hasEnergyProfile ? (
          <>
            <View style={styles.energyRow}>
              <View style={styles.energyItem}>
                <Text style={styles.energyValue}>{Math.round(bmr)}</Text>
                <Text style={styles.energyLabel}>BMR kcal</Text>
              </View>
              <View style={styles.energyDivider} />
              <View style={styles.energyItem}>
                <Text style={styles.energyValue}>{Math.round(tdee)}</Text>
                <Text style={styles.energyLabel}>TDEE kcal</Text>
              </View>
            </View>
            <Text style={styles.energyNote}>
              {profile.activityLevel?.replace(/_/g, ' ')} · Estimates only
            </Text>
          </>
        ) : (
          <View style={styles.energyEmpty}>
            <Zap size={20} color={colors.textMuted} />
            <Text style={styles.emptyCardText}>
              Complete your body profile to see energy calculations
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.editProfileBtn}
          onPress={() => navigation.navigate('BodyProfile')}
        >
          <Text style={styles.editProfileBtnText}>Edit Body Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: spacing.md },

  pageHeader: { marginTop: spacing.sm, marginBottom: spacing.md },
  pageTitle: { color: colors.text, fontSize: 28, fontWeight: '800' },
  pageSubtitle: { color: colors.textMuted, fontSize: 15, marginTop: 2 },

  quickRow: { marginBottom: spacing.md },
  primaryAction: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryActionText: { color: colors.primaryDark, fontWeight: '700', fontSize: 16 },

  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tile: {
    width: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  tileValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  tileNoLogs: { color: colors.textMuted, fontSize: 16, fontWeight: '600', marginTop: 2 },
  tileLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  goalCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  goalCardType: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  goalCardValues: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  goalStatusBadge: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  progressBg: {
    height: 8,
    backgroundColor: colors.bg,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  goalDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  goalDateText: { color: colors.textMuted, fontSize: 12 },
  viewGoalLink: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: 4 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  emptyCardText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  createGoalBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  createGoalBtnText: { color: colors.primary, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  energyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  energyItem: { flex: 1, alignItems: 'center' },
  energyDivider: { width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: spacing.md },
  energyValue: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  energyLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  energyNote: { color: colors.textMuted, fontSize: 11, textAlign: 'center', textTransform: 'capitalize' },
  energyEmpty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  editProfileBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  editProfileBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
