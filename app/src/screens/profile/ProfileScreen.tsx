import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  Settings, Share2, TrendingUp, Award, Dumbbell, Clock, History, ChevronRight,
  ChevronLeft, ChevronDown, ChevronUp, Camera, Target, Scale, Zap, Utensils, Activity, Calendar
} from 'lucide-react-native';
import Svg, { Polyline, Rect, Line, Text as SvgText } from 'react-native-svg';
import { colors, spacing, radius, useTheme } from '../../theme/colors';
import { useCurrentUser } from '../../context/CurrentUser';
import {
  currentUserId, signOutUser, getMeasurementHistory, getActiveGoal,
  getExercisesByIds, getWorkoutHistory, searchExercises, getPersonalRecords, getFoodLog
} from '../../services/index';
import { getAvatarBg } from '../../utils/formatting/avatarColors';
import {
  getUnitSystem,
  convertWeightToDisplay,
  getWeightUnit,
  convertCmToDisplay,
  getMeasurementUnit,
  convertWeightToCanonical,
  convertCmToCanonical
} from '../../utils/formatting/units';
import { logMeasurement, getGoals } from '../../services/measurements/measurements';
import { todayISO } from '../../utils/formatting/dates';
import type { MeasurementEntry, MeasurementGoal, MeasurementType, Workout, Exercise, PersonalRecord } from '../../models/index';
import MuscleSilhouette, { aggregateMusclesFromExercises } from '../../components/common/MuscleSilhouette';
import type { MuscleId } from '../../components/anatomy';
import { THEME_HEAT_PALETTES, DEFAULT_HEAT_PALETTE } from '../../components/anatomy';
import { mapRawToLovableMuscleId } from '../../utils/muscleHeatmap';
import ExpandableMeasurementCard from '../../components/measurements/ExpandableMeasurementCard';

type MeTab = 'overview' | 'exercises' | 'measures' | 'photos';
type OverviewSubTab = 'recent' | 'muscles';

// Standard 12 Muscle Taxonomy
export const STANDARD_MUSCLES = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Abs',
  'Obliques',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
] as const;

export type StandardMuscle = typeof STANDARD_MUSCLES[number];

export function mapToStandardMuscle(raw: string): StandardMuscle | null {
  const n = (raw || '').toLowerCase().trim();
  if (n.includes('pec') || n.includes('chest')) return 'Chest';
  if (n.includes('lat') || n.includes('trap') || n.includes('back') || n.includes('spine') || n.includes('rhomboid') || n.includes('teres')) return 'Back';
  if (n.includes('delt') || n.includes('shoulder')) return 'Shoulders';
  if (n.includes('bicep') || n.includes('brachialis')) return 'Biceps';
  if (n.includes('tricep')) return 'Triceps';
  if (n.includes('forearm') || n.includes('wrist') || n.includes('grip')) return 'Forearms';
  if (n.includes('abdom') || n.includes('abs') || n.includes('core')) return 'Abs';
  if (n.includes('oblique') || n.includes('serratus')) return 'Obliques';
  if (n.includes('quad') || n.includes('adductor') || n.includes('thigh') || n.includes('sartorius')) return 'Quads';
  if (n.includes('hamstring') || n.includes('biceps femoris')) return 'Hamstrings';
  if (n.includes('glute') || n.includes('buttock')) return 'Glutes';
  if (n.includes('calf') || n.includes('calve') || n.includes('gastro') || n.includes('soleus') || n.includes('tibialis')) return 'Calves';
  return null;
}

// Calendar Week Helper (Monday - Sunday)
function getStartOfWeek(date: Date = new Date()): number {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getEndOfWeek(date: Date = new Date()): number {
  const start = getStartOfWeek(date);
  return start + 7 * 24 * 60 * 60 * 1000 - 1;
}

export interface MuscleWeeklyAnalytics {
  name: StandardMuscle;
  setsThisWeek: number;
  volumeThisWeekKg: number;
  recoveryPercentage: number;
  recoveryStatus: 'Full' | 'Good' | 'Moderate' | 'Low';
  lastTrainedDate: string | null;
  recentExercises: {
    name: string;
    bestSet: string;
  }[];
  weeklyVolumeTrend: {
    weekLabel: string;
    volume: number;
  }[];
}

// Compute Muscle Analytics (Weekly Sets, Volume, Recovery %, Recent Exercises, 4-Week Trend)
function computeMuscleAnalytics(
  workouts: Workout[],
  exercisesMap: Record<string, Exercise>,
  system: 'metric' | 'imperial'
): MuscleWeeklyAnalytics[] {
  const now = Date.now();
  const startOfWeek = getStartOfWeek(new Date(now));
  const endOfWeek = getEndOfWeek(new Date(now));
  const weightUnit = getWeightUnit(system);

  // 4 Week intervals for trend
  const weeks = [
    { label: 'W1', start: startOfWeek - 21 * 86400000, end: startOfWeek - 14 * 86400000 - 1 },
    { label: 'W2', start: startOfWeek - 14 * 86400000, end: startOfWeek - 7 * 86400000 - 1 },
    { label: 'W3', start: startOfWeek - 7 * 86400000, end: startOfWeek - 1 },
    { label: 'W4', start: startOfWeek, end: endOfWeek },
  ];

  const sortedWorkouts = [...workouts].sort((a, b) => b.createdAt - a.createdAt);

  return STANDARD_MUSCLES.map((muscle) => {
    let setsThisWeek = 0;
    let volumeThisWeekKg = 0;
    const weekVolumesKg = [0, 0, 0, 0];

    const recentExerciseMap: Map<string, { name: string; maxWeightKg: number; reps: number; timestamp: number }> = new Map();
    let lastTrainedTimestamp: number | null = null;
    let lastTrainedSets = 0;

    for (const wkt of sortedWorkouts) {
      let workoutTargetedMuscle = false;
      let sessionSets = 0;

      for (const entry of wkt.entries) {
        const ex = exercisesMap[entry.exerciseId];
        if (!ex) continue;

        const primaryMatch = mapToStandardMuscle(ex.muscleGroup) === muscle;
        const secondaryMatch = (ex.secondaryMuscles || []).some((sm: string) => mapToStandardMuscle(sm) === muscle);

        if (primaryMatch || secondaryMatch) {
          workoutTargetedMuscle = true;
          const completedSets = entry.sets.filter((s: any) => s.reps > 0);
          sessionSets += completedSets.length;

          // Sets and volume in current calendar week
          if (wkt.createdAt >= startOfWeek && wkt.createdAt <= endOfWeek) {
            setsThisWeek += completedSets.length;
            for (const s of completedSets) {
              volumeThisWeekKg += (s.weightKg || 0) * (s.reps || 0);
            }
          }

          // Volume trend per week
          for (let wi = 0; wi < weeks.length; wi++) {
            if (wkt.createdAt >= weeks[wi].start && wkt.createdAt <= weeks[wi].end) {
              for (const s of completedSets) {
                weekVolumesKg[wi] += (s.weightKg || 0) * (s.reps || 0);
              }
            }
          }

          // Track unique recent exercises
          if (!recentExerciseMap.has(entry.exerciseId) && completedSets.length > 0) {
            let maxW = 0;
            let maxReps = 0;
            for (const s of completedSets) {
              if (s.weightKg >= maxW) {
                maxW = s.weightKg;
                maxReps = s.reps;
              }
            }
            recentExerciseMap.set(entry.exerciseId, {
              name: ex.name,
              maxWeightKg: maxW,
              reps: maxReps,
              timestamp: wkt.createdAt,
            });
          }
        }
      }

      if (workoutTargetedMuscle && lastTrainedTimestamp === null) {
        lastTrainedTimestamp = wkt.createdAt;
        lastTrainedSets = sessionSets;
      }
    }

    // Data-driven training-load / time-decay recovery calculation
    let recoveryPercentage = 100;
    if (lastTrainedTimestamp !== null) {
      const hoursSince = Math.max(0, (now - lastTrainedTimestamp) / (1000 * 3600));
      if (hoursSince < 72) {
        const acuteFatigue = Math.min(80, lastTrainedSets * 4 + 20);
        const recoveredFraction = Math.pow(hoursSince / 72, 1.25);
        recoveryPercentage = Math.round(100 - acuteFatigue * (1 - recoveredFraction));
        recoveryPercentage = Math.max(15, Math.min(100, recoveryPercentage));
      } else {
        recoveryPercentage = 100;
      }
    }

    let recoveryStatus: 'Full' | 'Good' | 'Moderate' | 'Low' = 'Full';
    if (recoveryPercentage < 50) recoveryStatus = 'Low';
    else if (recoveryPercentage < 75) recoveryStatus = 'Moderate';
    else if (recoveryPercentage < 95) recoveryStatus = 'Good';
    else recoveryStatus = 'Full';

    const recentExercises = Array.from(recentExerciseMap.values())
      .slice(0, 4)
      .map(e => {
        const displayW = convertWeightToDisplay(e.maxWeightKg, system);
        return {
          name: e.name,
          bestSet: e.maxWeightKg > 0 ? `${displayW} ${weightUnit} × ${e.reps}` : `${e.reps} reps`,
        };
      });

    const weeklyVolumeTrend = weeks.map((wk, idx) => ({
      weekLabel: wk.label,
      volume: Math.round(convertWeightToDisplay(weekVolumesKg[idx], system)),
    }));

    return {
      name: muscle,
      setsThisWeek,
      volumeThisWeekKg,
      recoveryPercentage,
      recoveryStatus,
      lastTrainedDate: lastTrainedTimestamp ? new Date(lastTrainedTimestamp).toLocaleDateString() : null,
      recentExercises,
      weeklyVolumeTrend,
    };
  });
}

// Compact Weekly Volume Bar Chart
function MuscleVolumeBarChart({
  trend,
  unit,
  primaryColor,
  surfaceElevatedColor,
  textColor,
  textMutedColor,
}: {
  trend: { weekLabel: string; volume: number }[];
  unit: string;
  primaryColor: string;
  surfaceElevatedColor: string;
  textColor: string;
  textMutedColor: string;
}) {
  const maxVol = Math.max(...trend.map(t => t.volume), 1);
  const chartHeight = 54;
  const barWidth = 32;

  return (
    <View style={{ gap: 6, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: chartHeight }}>
        {trend.map((t, i) => {
          const heightPercent = t.volume > 0 ? Math.max(0.15, t.volume / maxVol) : 0.06;
          const barH = heightPercent * (chartHeight - 16);
          const isLatest = i === trend.length - 1;

          return (
            <View key={i} style={{ alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 8, fontWeight: '700', color: isLatest ? primaryColor : textMutedColor }}>
                {t.volume > 0 ? (t.volume >= 1000 ? `${(t.volume / 1000).toFixed(1)}k` : `${t.volume}`) : '—'}
              </Text>
              <View
                style={{
                  width: barWidth,
                  height: barH,
                  backgroundColor: isLatest ? primaryColor : surfaceElevatedColor,
                  borderRadius: 3,
                }}
              />
              <Text style={{ fontSize: 9, fontWeight: '700', color: isLatest ? textColor : textMutedColor }}>
                {t.weekLabel}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: 9, color: textMutedColor, textAlign: 'center' }}>
        Volume ({unit}) · 4-Week Trend
      </Text>
    </View>
  );
}

const MEASUREMENT_TILES: { type: MeasurementType; label: string; unit: string }[] = [
  { type: 'weight', label: 'Body Weight', unit: 'kg' },
  { type: 'body_fat', label: 'Body Fat', unit: '%' },
  { type: 'waist', label: 'Waist', unit: 'cm' },
  { type: 'chest', label: 'Chest', unit: 'cm' },
  { type: 'bicep', label: 'Biceps', unit: 'cm' },
  { type: 'thigh', label: 'Thighs', unit: 'cm' },
  { type: 'hips', label: 'Hips', unit: 'cm' },
  { type: 'neck', label: 'Neck', unit: 'cm' },
  { type: 'forearm', label: 'Forearms', unit: 'cm' },
  { type: 'calf', label: 'Calves', unit: 'cm' },
];

const LOG_FIELDS: { type: MeasurementType; label: string; unit: string; placeholder: string }[] = [
  { type: 'weight', label: 'Weight', unit: 'kg', placeholder: 'e.g. 82.5' },
  { type: 'body_fat', label: 'Body Fat %', unit: '%', placeholder: 'e.g. 18' },
  { type: 'waist', label: 'Waist', unit: 'cm', placeholder: 'Optional' },
  { type: 'chest', label: 'Chest', unit: 'cm', placeholder: 'Optional' },
  { type: 'bicep', label: 'Bicep', unit: 'cm', placeholder: 'Optional' },
  { type: 'thigh', label: 'Thigh', unit: 'cm', placeholder: 'Optional' },
  { type: 'hips', label: 'Hips', unit: 'cm', placeholder: 'Optional' },
  { type: 'neck', label: 'Neck', unit: 'cm', placeholder: 'Optional' },
  { type: 'forearm', label: 'Forearm', unit: 'cm', placeholder: 'Optional' },
  { type: 'calf', label: 'Calf', unit: 'cm', placeholder: 'Optional' },
];

function MiniTrendChart({ history }: { history: MeasurementEntry[] }) {
  if (history.length < 2) return null;
  const values = history.map(h => h.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const points = history
    .slice(-5)
    .map((h, idx, arr) => {
      const x = arr.length > 1 ? (idx / (arr.length - 1)) * 60 : 30;
      const y = 20 - ((h.value - min) / range) * 16;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={styles.sparkline}>
      <Svg width={60} height={22}>
        <Polyline fill="none" stroke={colors.primary} strokeWidth={1.8} points={points} />
      </Svg>
    </View>
  );
}

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { profile } = useCurrentUser();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const system = getUnitSystem(profile);
  const [activeTab, setActiveTab] = useState<MeTab>('overview');

  // Overview sub-tab state
  const [overviewSubTab, setOverviewSubTab] = useState<OverviewSubTab>('recent');
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null);

  const activeHeatPalette = useMemo(() => {
    const themeId = (theme as any)?.id || 'signature';
    return THEME_HEAT_PALETTES[themeId] || DEFAULT_HEAT_PALETTE;
  }, [theme]);

  // Month selector state for Muscle Activity anatomy
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(new Date());

  // Overview states
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercisesMap, setExercisesMap] = useState<Record<string, Exercise>>({});
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [errorOverview, setErrorOverview] = useState(false);

  // Measures states
  const [latestByType, setLatestByType] = useState<Record<string, MeasurementEntry | null>>({});
  const [historyByType, setHistoryByType] = useState<Record<string, MeasurementEntry[]>>({});
  const [goalsByType, setGoalsByType] = useState<Record<string, MeasurementGoal>>({});
  const [activeGoal, setActiveGoal] = useState<MeasurementGoal | null>(null);
  const [expandedMeasurement, setExpandedMeasurement] = useState<string | null>('weight');
  const [loadingMeasures, setLoadingMeasures] = useState(false);
  const [errorMeasures, setErrorMeasures] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logValues, setLogValues] = useState<Record<string, string>>({});
  const [logSaving, setLogSaving] = useState(false);
  const [todayCalories, setTodayCalories] = useState<number | null>(null);

  // Exercises states
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseResults, setExerciseResults] = useState<Exercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [prs, setPrs] = useState<Record<string, PersonalRecord>>({});
  const [prExercises, setPrExercises] = useState<Record<string, Exercise>>({});

  // Responsive dimension variables
  const windowWidth = Dimensions.get('window').width;
  const silhouetteSize = Math.floor((windowWidth - 48) / 2);

  const loadOverviewData = useCallback(async () => {
    const uid = currentUserId();
    if (!uid) return;
    setLoadingOverview(true);
    setErrorOverview(false);
    try {
      const wkts = await getWorkoutHistory(uid, 50);
      setWorkouts(wkts);

      const allExIds = Array.from(new Set(wkts.flatMap(w => w.entries.map(e => e.exerciseId))));
      if (allExIds.length > 0) {
        const exercises = await getExercisesByIds(allExIds);
        const exMap: Record<string, Exercise> = {};
        exercises.forEach(e => { exMap[e.id] = e; });
        setExercisesMap(exMap);
      }
    } catch (e) {
      console.error(e);
      setErrorOverview(true);
    }
    finally { setLoadingOverview(false); }
  }, []);

  const loadMeasuresData = useCallback(async () => {
    const uid = currentUserId();
    if (!uid) return;
    setLoadingMeasures(true);
    setErrorMeasures(false);
    try {
      const [allGoals, ...allData] = await Promise.all([
        getGoals(uid, 'active'),
        ...MEASUREMENT_TILES.map(t => getMeasurementHistory(uid, t.type)),
      ]);
      const byType: Record<string, MeasurementEntry | null> = {};
      const hist: Record<string, MeasurementEntry[]> = {};
      MEASUREMENT_TILES.forEach((t, i) => {
        const data = allData[i];
        byType[t.type] = data.length > 0 ? data[data.length - 1] : null;
        hist[t.type] = data;
      });

      const gMap: Record<string, MeasurementGoal> = {};
      allGoals.forEach(g => {
        gMap[g.measurementType] = g;
      });
      setGoalsByType(gMap);
      setActiveGoal(allGoals.length > 0 ? allGoals[0] : null);
      setLatestByType(byType);
      setHistoryByType(hist);

      const meals = await getFoodLog(uid, todayISO());
      if (meals && meals.length > 0) {
        setTodayCalories(meals.reduce((sum, item) => sum + (item.calories || 0), 0));
      } else {
        setTodayCalories(0);
      }
    } catch (e) {
      console.error(e);
      setErrorMeasures(true);
    }
    finally { setLoadingMeasures(false); }
  }, []);

  const loadPrData = useCallback(async () => {
    const uid = currentUserId();
    if (!uid) return;
    try {
      const prList = await getPersonalRecords(uid);
      const dict: Record<string, PersonalRecord> = {};
      prList.forEach(p => {
        dict[p.exerciseId] = p;
      });
      setPrs(dict);

      const exIds = prList.map(p => p.exerciseId);
      if (exIds.length > 0) {
        const exercises = await getExercisesByIds(exIds);
        const exDict: Record<string, Exercise> = {};
        exercises.forEach(e => { exDict[e.id] = e; });
        setPrExercises(exDict);
      }
    } catch (e) { console.error(e); }
  }, []);

  useFocusEffect(useCallback(() => {
    loadOverviewData();
    loadMeasuresData();
    loadPrData();
  }, [loadOverviewData, loadMeasuresData, loadPrData]));

  useEffect(() => {
    if (!exerciseSearch.trim()) { setExerciseResults([]); return; }
    const t = setTimeout(async () => {
      setLoadingEx(true);
      try {
        const results = await searchExercises(exerciseSearch.trim());
        setExerciseResults(results);
      } finally { setLoadingEx(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [exerciseSearch]);

  const handleLogMeasurements = async () => {
    const uid = currentUserId();
    if (!uid || logSaving) return;
    const hasValue = Object.values(logValues).some(v => v.trim());
    if (!hasValue) return Alert.alert('No data', 'Enter at least one measurement value.');
    setLogSaving(true);
    try {
      await Promise.all(
        LOG_FIELDS
          .filter(f => logValues[f.type]?.trim())
          .map(f => logMeasurement(uid, {
            userId: uid,
            type: f.type,
            value: parseFloat(logValues[f.type]),
            unit: f.unit,
            recordedAt: Date.now(),
          }))
      );
      setLogValues({});
      setShowLogModal(false);
      await loadMeasuresData();
      Alert.alert('Saved!', 'Measurements logged successfully.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save measurements.');
    } finally { setLogSaving(false); }
  };

  // Monthly muscle aggregation for the Anatomy Hero
  const { monthlyMuscles, monthlyMuscleSetCounts } = useMemo(() => {
    const start = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1).getTime();
    const end = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    const monthWorkouts = workouts.filter(w => w.createdAt >= start && w.createdAt <= end);
    const exIds = Array.from(new Set(monthWorkouts.flatMap(w => w.entries.map((e: any) => e.exerciseId))));
    const exercises = exIds.map(id => exercisesMap[id]).filter(Boolean);

    const counts: Partial<Record<MuscleId, number>> = {};
    for (const w of monthWorkouts) {
      for (const entry of w.entries) {
        const ex = exercisesMap[entry.exerciseId];
        if (!ex) continue;
        const pId = mapRawToLovableMuscleId(ex.muscleGroup);
        const completedSets = (entry.sets || []).filter((s: any) => (s.reps || 0) > 0).length;
        if (pId) {
          counts[pId] = (counts[pId] || 0) + completedSets;
        }
        for (const sm of (ex.secondaryMuscles ?? []) as string[]) {
          const sId = mapRawToLovableMuscleId(sm);
          if (sId && sId !== pId) {
            counts[sId] = (counts[sId] || 0) + Math.round(completedSets * 0.5);
          }
        }
      }
    }

    return {
      monthlyMuscles: aggregateMusclesFromExercises(exercises),
      monthlyMuscleSetCounts: counts,
    };
  }, [workouts, exercisesMap, selectedMonthDate]);

  // Weekly muscle analytics for the Muscles Tab
  const weeklyMuscleAnalytics = useMemo(() => {
    return computeMuscleAnalytics(workouts, exercisesMap, system);
  }, [workouts, exercisesMap, system]);

  // General weekly stats (top summary cards)
  const { sessionsThisWeek, totalVolumeThisWeek } = useMemo(() => {
    const startOfWeek = getStartOfWeek(new Date());
    const endOfWeek = getEndOfWeek(new Date());
    const wk = workouts.filter(w => w.createdAt >= startOfWeek && w.createdAt <= endOfWeek);
    const vol = wk.reduce((sum, w) => sum + (w.totalVolumeKg || 0), 0);
    return { sessionsThisWeek: wk.length, totalVolumeThisWeek: vol };
  }, [workouts]);

  // Month date range formatted string
  const monthRangeText = useMemo(() => {
    const now = new Date();
    const isCurrent = selectedMonthDate.getFullYear() === now.getFullYear() && selectedMonthDate.getMonth() === now.getMonth();
    const monthShort = selectedMonthDate.toLocaleDateString('en-US', { month: 'short' });
    if (isCurrent) {
      return `${monthShort} 1 – ${monthShort} ${now.getDate()}`;
    }
    const lastDay = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0).getDate();
    return `${monthShort} 1 – ${monthShort} ${lastDay}`;
  }, [selectedMonthDate]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return selectedMonthDate.getFullYear() === now.getFullYear() && selectedMonthDate.getMonth() === now.getMonth();
  }, [selectedMonthDate]);

  const currentWeekRangeText = useMemo(() => {
    const start = new Date(getStartOfWeek(new Date()));
    const end = new Date(getEndOfWeek(new Date()));
    const sStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const eStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${sStr} – ${eStr}`;
  }, []);

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerUser}>
          <View style={[styles.avatar, { backgroundColor: getAvatarBg(profile.displayName || 'User') }]}>
            <Text style={styles.avatarText}>
              {(profile.displayName || 'U').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile.displayName || 'Iron Athlete'}</Text>
            <Text style={styles.userSub}>@{profile.username || 'athlete'}</Text>
          </View>
        </View>
        <View style={styles.profileActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Settings')}>
            <Settings size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tabs */}
      <View style={styles.tabs}>
        {(['overview', 'exercises', 'measures', 'photos'] as MeTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* ================================================================ */}
        {/* TAB 1: OVERVIEW */}
        {/* ================================================================ */}
        {activeTab === 'overview' && (
          errorOverview ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load training overview.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadOverviewData}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Training Summary Cards */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{sessionsThisWeek}</Text>
                  <Text style={styles.statLbl}>Sessions This Week</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{profile.currentStreak || 0}🔥</Text>
                  <Text style={styles.statLbl}>Day Streak</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{totalVolumeThisWeek > 0 ? Math.round(totalVolumeThisWeek / 1000) + 'k' : '—'}</Text>
                  <Text style={styles.statLbl}>Vol (t) This Week</Text>
                </View>
              </View>

              {/* Monthly Muscle Activity Section (HERO ANATOMY) */}
              <View style={styles.muscleContainerCard}>
                {/* Month Selector Bar */}
                <View style={styles.monthSelectorRow}>
                  <TouchableOpacity
                    style={styles.monthNavBtn}
                    onPress={() => setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  >
                    <ChevronLeft size={18} color={theme.colors.textPrimary} />
                  </TouchableOpacity>

                  <View style={styles.monthTitleCol}>
                    <Text style={[styles.monthTitleText, { color: theme.colors.textPrimary }]}>
                      {selectedMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
                    </Text>
                    <Text style={[styles.monthDateRangeText, { color: theme.colors.textSecondary }]}>
                      {monthRangeText} · MUSCLE ACTIVITY
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.monthNavBtn, isCurrentMonth && { opacity: 0.25 }]}
                    disabled={isCurrentMonth}
                    onPress={() => setSelectedMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  >
                    <ChevronRight size={18} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                
                {loadingOverview ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
                ) : (
                  <View style={styles.bodyVizRow}>
                    <View style={[styles.bodyVizItem, { width: silhouetteSize }]}>
                      <Text style={styles.bodyVizLabel}>ANTERIOR (FRONT)</Text>
                      <MuscleSilhouette
                        primaryMuscles={monthlyMuscles.primary}
                        secondaryMuscles={monthlyMuscles.secondary}
                        setCounts={monthlyMuscleSetCounts}
                        view="front"
                        size={silhouetteSize - 16}
                      />
                    </View>
                    <View style={[styles.bodyVizItem, { width: silhouetteSize }]}>
                      <Text style={styles.bodyVizLabel}>POSTERIOR (BACK)</Text>
                      <MuscleSilhouette
                        primaryMuscles={monthlyMuscles.primary}
                        secondaryMuscles={monthlyMuscles.secondary}
                        setCounts={monthlyMuscleSetCounts}
                        view="back"
                        size={silhouetteSize - 16}
                      />
                    </View>
                  </View>
                )}

                {/* Heat Intensity Scale Legend */}
                <View style={styles.legendContainer}>
                  <View style={styles.heatScaleRow}>
                    <Text style={[styles.heatScaleLabel, { color: theme.colors.textSecondary }]}>LOW</Text>
                    <View style={styles.heatScaleBar}>
                      {activeHeatPalette.map((col, idx) => (
                        <View key={idx} style={[styles.heatScaleSegment, { backgroundColor: col }]} />
                      ))}
                    </View>
                    <Text style={[styles.heatScaleLabel, { color: theme.colors.textSecondary }]}>HIGH</Text>
                  </View>
                </View>
              </View>

              {/* OVERVIEW SUB-TABS: [ RECENT EXERCISES ] [ MUSCLES ] */}
              <View style={[styles.subTabRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.subTabBtn,
                    overviewSubTab === 'recent' && [styles.subTabBtnActive, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.primary }]
                  ]}
                  onPress={() => setOverviewSubTab('recent')}
                >
                  <Text
                    style={[
                      styles.subTabText,
                      { color: overviewSubTab === 'recent' ? theme.colors.primary : theme.colors.textSecondary }
                    ]}
                  >
                    RECENT EXERCISES
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.subTabBtn,
                    overviewSubTab === 'muscles' && [styles.subTabBtnActive, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.primary }]
                  ]}
                  onPress={() => setOverviewSubTab('muscles')}
                >
                  <Text
                    style={[
                      styles.subTabText,
                      { color: overviewSubTab === 'muscles' ? theme.colors.primary : theme.colors.textSecondary }
                    ]}
                  >
                    MUSCLES
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ============================================================ */}
              {/* SUB-TAB 1: RECENT EXERCISES / WORKOUTS HISTORY */}
              {/* ============================================================ */}
              {overviewSubTab === 'recent' && (
                <>
                  <View style={styles.historySectionHeaderRow}>
                    <Text style={styles.sectionLabel}>RECENT WORKOUTS</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('WorkoutHistory')}>
                      <Text style={styles.seeAllLink}>See All ({workouts.length})</Text>
                    </TouchableOpacity>
                  </View>

                  {workouts.slice(0, 5).map(w => (
                    <TouchableOpacity key={w.id} style={styles.workoutPremiumCard} activeOpacity={0.8} onPress={() => navigation.navigate('WorkoutDetail', { workoutId: w.id, userId: profile?.id })}>
                      <View style={styles.workoutCardTop}>
                        <View style={styles.workoutTitleCol}>
                          <Text style={styles.workoutName}>{w.planName || 'Custom Workout'}</Text>
                          {w.workoutType === 'duo' && w.duoPartnerName && (
                            <View style={styles.duoBadge}>
                              <Text style={styles.duoBadgeText}>🤝 Duo with {w.duoPartnerName}</Text>
                            </View>
                          )}
                          <Text style={styles.workoutDate}>
                            {new Date(w.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                        {w.totalVolumeKg ? (
                          <View style={styles.volBadge}>
                            <Text style={styles.volBadgeVal}>
                              {Math.round(convertWeightToDisplay(w.totalVolumeKg, system)).toLocaleString()} {getWeightUnit(system)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.workoutCardDivider} />
                      <View style={styles.workoutCardBottom}>
                        <View style={styles.workoutStatCol}>
                          <Clock size={13} color={colors.textMuted} />
                          <Text style={styles.workoutStatVal}>{w.durationMinutes ? `${w.durationMinutes} min` : '—'}</Text>
                        </View>
                        <View style={styles.workoutStatCol}>
                          <Award size={13} color={colors.milestone} />
                          <Text style={styles.workoutStatVal}>{w.entries.length} Exercises</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}

                  {workouts.length === 0 && !loadingOverview && (
                    <View style={styles.emptyBox}>
                      <Dumbbell size={28} color={colors.textMuted} />
                      <Text style={styles.emptyText}>No workout logs found. Start logging to build your profile history!</Text>
                    </View>
                  )}
                </>
              )}

              {/* ============================================================ */}
              {/* SUB-TAB 2: MUSCLES (WEEKLY MUSCLE CARDS + RECOVERY) */}
              {/* ============================================================ */}
              {overviewSubTab === 'muscles' && (
                <View style={{ gap: spacing.sm }}>
                  <View style={styles.historySectionHeaderRow}>
                    <View>
                      <Text style={styles.sectionLabel}>MUSCLES</Text>
                      <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                        THIS WEEK · {currentWeekRangeText}
                      </Text>
                    </View>
                    <View style={styles.recoverySummaryBadge}>
                      <Activity size={12} color={theme.colors.primary} />
                      <Text style={[styles.recoverySummaryText, { color: theme.colors.primary }]}>
                        Live Recovery
                      </Text>
                    </View>
                  </View>

                  {weeklyMuscleAnalytics.map((m) => {
                    const isExpanded = expandedMuscle === m.name;
                    const recoveryColor =
                      m.recoveryPercentage >= 80
                        ? theme.colors.success || '#10b981'
                        : m.recoveryPercentage >= 50
                        ? theme.colors.warning || '#eab308'
                        : theme.colors.danger || '#ef4444';

                    const recoveryBg =
                      m.recoveryPercentage >= 80
                        ? 'rgba(16,185,129,0.12)'
                        : m.recoveryPercentage >= 50
                        ? 'rgba(234,179,8,0.12)'
                        : 'rgba(239,68,68,0.12)';

                    const recoveryBorder =
                      m.recoveryPercentage >= 80
                        ? 'rgba(16,185,129,0.28)'
                        : m.recoveryPercentage >= 50
                        ? 'rgba(234,179,8,0.28)'
                        : 'rgba(239,68,68,0.28)';

                    return (
                      <TouchableOpacity
                        key={m.name}
                        style={[
                          styles.muscleCard,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: isExpanded ? theme.colors.primary : theme.colors.border,
                          }
                        ]}
                        activeOpacity={0.85}
                        onPress={() => setExpandedMuscle(isExpanded ? null : m.name)}
                      >
                        {/* Collapsed Card Header */}
                        <View style={styles.muscleCardHeader}>
                          <View style={styles.muscleTitleCol}>
                            <Text style={[styles.muscleCardName, { color: theme.colors.textPrimary }]}>
                              {m.name.toUpperCase()}
                            </Text>
                            <Text style={[styles.muscleCardSub, { color: theme.colors.textSecondary }]}>
                              {m.setsThisWeek > 0
                                ? `${m.setsThisWeek} sets · ${Math.round(convertWeightToDisplay(m.volumeThisWeekKg, system)).toLocaleString()} ${getWeightUnit(system)}`
                                : 'No activity this week'}
                            </Text>
                          </View>

                          <View style={styles.muscleCardRight}>
                            <View
                              style={[
                                styles.recoveryBadge,
                                {
                                  backgroundColor: recoveryBg,
                                  borderColor: recoveryBorder,
                                }
                              ]}
                            >
                              <Text style={[styles.recoveryBadgeText, { color: recoveryColor }]}>
                                {m.recoveryPercentage}%
                              </Text>
                            </View>
                            {isExpanded ? (
                              <ChevronUp size={16} color={theme.colors.textSecondary} />
                            ) : (
                              <ChevronDown size={16} color={theme.colors.textSecondary} />
                            )}
                          </View>
                        </View>

                        {/* Expanded Card Body */}
                        {isExpanded && (
                          <View style={styles.muscleExpandedBody}>
                            <View style={[styles.muscleDivider, { backgroundColor: theme.colors.border }]} />

                            {/* ESTIMATED RECOVERY STATUS */}
                            <View style={styles.recoveryDetailRow}>
                              <Text style={[styles.muscleSectionSubHeader, { color: theme.colors.textSecondary }]}>
                                ESTIMATED RECOVERY
                              </Text>
                              <Text style={{ color: recoveryColor, fontSize: 11, fontWeight: '700' }}>
                                {m.recoveryPercentage}% · {m.recoveryPercentage >= 80 ? 'Ready / Recovered' : m.recoveryPercentage >= 50 ? 'Recovering' : 'Fatigued'}
                              </Text>
                            </View>
                            <View style={[styles.recoveryProgressBarBg, { backgroundColor: theme.colors.surfaceElevated }]}>
                              <View
                                style={[
                                  styles.recoveryProgressBarFill,
                                  { width: `${m.recoveryPercentage}%`, backgroundColor: recoveryColor }
                                ]}
                              />
                            </View>

                            <View style={[styles.muscleDivider, { backgroundColor: theme.colors.border }]} />

                            {/* RECENT EXERCISES */}
                            <View style={{ gap: 6 }}>
                              <Text style={[styles.muscleSectionSubHeader, { color: theme.colors.textSecondary }]}>
                                RECENT EXERCISES
                              </Text>
                              {m.recentExercises.length > 0 ? (
                                m.recentExercises.map((re, idx) => (
                                  <View key={idx} style={styles.recentExRow}>
                                    <Text style={[styles.recentExName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                                      {re.name}
                                    </Text>
                                    <Text style={[styles.recentExSet, { color: theme.colors.primary }]}>
                                      {re.bestSet}
                                    </Text>
                                  </View>
                                ))
                              ) : (
                                <Text style={[styles.recentExEmpty, { color: theme.colors.textMuted }]}>
                                  No recent exercises logged for {m.name}.
                                </Text>
                              )}
                            </View>

                            <View style={[styles.muscleDivider, { backgroundColor: theme.colors.border }]} />

                            {/* VOLUME TREND */}
                            <View style={{ gap: 6 }}>
                              <Text style={[styles.muscleSectionSubHeader, { color: theme.colors.textSecondary }]}>
                                VOLUME TREND
                              </Text>
                              <MuscleVolumeBarChart
                                trend={m.weeklyVolumeTrend}
                                unit={getWeightUnit(system)}
                                primaryColor={theme.colors.primary}
                                surfaceElevatedColor={theme.colors.surfaceElevated}
                                textColor={theme.colors.textPrimary}
                                textMutedColor={theme.colors.textSecondary}
                              />
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )
        )}

        {/* ================================================================ */}
        {/* TAB 2: EXERCISES & 1RM PR RECORDS */}
        {/* ================================================================ */}
        {activeTab === 'exercises' && (
          <>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercise PRs (e.g. Bench, Squat)..."
                placeholderTextColor={colors.textMuted}
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
              />
            </View>

            {loadingEx ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
            ) : Object.keys(prs).length === 0 ? (
              <View style={styles.emptyBox}>
                <Award size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No personal records logged yet. Complete sets in workouts to track your PR progression!</Text>
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {Object.values(prs)
                  .filter(p => {
                    const ex = prExercises[p.exerciseId];
                    if (!exerciseSearch.trim()) return true;
                    return (ex?.name || '').toLowerCase().includes(exerciseSearch.toLowerCase());
                  })
                  .map(p => {
                    const ex = prExercises[p.exerciseId];
                    const display1RM = convertWeightToDisplay(p.estimated1RM, system);
                    const displayBest = convertWeightToDisplay(p.bestWeightKg, system);
                    const unit = getWeightUnit(system);

                    return (
                      <View key={p.exerciseId} style={styles.exercisePremiumCard}>
                        <View style={styles.exCardTop}>
                          <View style={styles.exThumbnail}>
                            <Text style={styles.exThumbText}>
                              {(ex?.name || 'Ex').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.exDetails}>
                            <Text style={styles.exTitle}>{ex?.name || 'Exercise Record'}</Text>
                            <Text style={styles.exSubtitle}>
                              {ex?.muscleGroup || 'Strength'} • Achieved {new Date(p.achievedOn).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.exPrRow}>
                          <View style={styles.prBox}>
                            <Text style={styles.prLabel}>ESTIMATED 1RM</Text>
                            <Text style={styles.prValue}>{display1RM} {unit}</Text>
                          </View>
                          <View style={styles.prBox}>
                            <Text style={styles.prLabel}>BEST WEIGHT × REPS</Text>
                            <Text style={styles.prValue}>{displayBest} {unit} × {p.bestReps}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 3: MEASURES */}
        {/* ================================================================ */}
        {activeTab === 'measures' && (
          errorMeasures ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load body measurements.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadMeasuresData}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.measuresActionRow}>
                <TouchableOpacity style={styles.logCTA} onPress={() => setShowLogModal(true)}>
                  <Scale size={16} color={colors.primaryDark} />
                  <Text style={styles.logCTAText}>+ Log Today's Measures</Text>
                </TouchableOpacity>
              </View>

              {activeGoal ? (
                <View style={styles.goalPremiumCard}>
                  <View style={styles.goalTopRow}>
                    <View>
                      <Text style={styles.goalLabel}>ACTIVE GOAL</Text>
                      <Text style={styles.goalTitle}>
                        {activeGoal.type === 'lose_weight' ? 'Weight Loss Target' : activeGoal.type === 'gain_weight' ? 'Weight Gain Target' : 'Body Weight Target'}
                      </Text>
                    </View>
                    <Target size={18} color={colors.primary} />
                  </View>
                  <View style={styles.goalBodyRow}>
                    <Text style={styles.goalDetailVal}>
                      Target: {convertWeightToDisplay(activeGoal.targetValue, system)} {getWeightUnit(system)}
                    </Text>
                    <Text style={styles.goalCurrentVal}>
                      Start: {convertWeightToDisplay(activeGoal.startValue, system)} {getWeightUnit(system)}
                    </Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.createGoalRowBtn} onPress={() => navigation.navigate('GoalSettings')}>
                  <Target size={16} color={colors.primary} />
                  <Text style={styles.createGoalRowText}>Set a target weight goal</Text>
                  <ChevronRight size={14} color={colors.primary} />
                </TouchableOpacity>
              )}

              {/* Expandable Measurement Cards List */}
              <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                {MEASUREMENT_TILES.map((t) => {
                  const hist = historyByType[t.type] || [];
                  const goalForType = goalsByType[t.type] || (t.type === 'weight' ? activeGoal : null);
                  const isExpanded = expandedMeasurement === t.type;

                  return (
                    <ExpandableMeasurementCard
                      key={t.type}
                      tile={t}
                      entries={hist}
                      goal={goalForType}
                      system={system}
                      isExpanded={isExpanded}
                      onToggle={() => {
                        setExpandedMeasurement((prev) => (prev === t.type ? null : t.type));
                      }}
                      onSetGoal={() => navigation.navigate('GoalSettings')}
                    />
                  );
                })}
              </View>
            </>
          )
        )}

        {/* ================================================================ */}
        {/* TAB 4: PHOTOS */}
        {/* ================================================================ */}
        {activeTab === 'photos' && (
          <View style={styles.photosEmptyContainer}>
            <View style={styles.photosIconCircle}>
              <Camera size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.photosTitle}>Visual Progress Gallery</Text>
            <Text style={styles.photosDesc}>
              Upload and compare front, side, and back physique photos to track visual muscle growth and transformation.
            </Text>
            <TouchableOpacity style={styles.photosCta} onPress={() => Alert.alert('Coming Soon', 'Photo upload gallery is in development.')}>
              <Text style={styles.photosCtaText}>Add Transformation Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Log Measurements Modal */}
      <Modal visible={showLogModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Body Measures</Text>
              <TouchableOpacity onPress={() => setShowLogModal(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
              {LOG_FIELDS.map(f => (
                <View key={f.type} style={styles.logFieldRow}>
                  <Text style={styles.logFieldLabel}>{f.label} ({f.type === 'weight' ? getWeightUnit(system) : f.type === 'body_fat' ? '%' : getMeasurementUnit(system)})</Text>
                  <TextInput
                    style={styles.logFieldInput}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={logValues[f.type] || ''}
                    onChangeText={txt => setLogValues(prev => ({ ...prev, [f.type]: txt }))}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleLogMeasurements} disabled={logSaving}>
                {logSaving ? (
                  <ActivityIndicator color={colors.primaryDark} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Measurements</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  headerUser: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  userInfo: { gap: 1 },
  userName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  userSub: { color: colors.textMuted, fontSize: 12 },
  profileActions: { flexDirection: 'row', gap: spacing.sm },
  headerIconBtn: { padding: spacing.xs },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.xs },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  tabTextActive: { color: colors.primary },

  tabContent: { padding: spacing.md, gap: spacing.md },

  sectionLabel: { color: colors.text, fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', gap: 4 },
  statNum: { color: colors.text, fontSize: 20, fontWeight: '900' },
  statLbl: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },

  // Muscle Activity Visual Redesign Card
  muscleContainerCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  
  monthSelectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs },
  monthNavBtn: { padding: spacing.xs, borderRadius: radius.sm },
  monthTitleCol: { alignItems: 'center', gap: 1 },
  monthTitleText: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  monthDateRangeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  bodyVizRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.xs },
  bodyVizItem: { alignItems: 'center', gap: spacing.xs },
  bodyVizLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  legendContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  heatScaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heatScaleBar: {
    flexDirection: 'row',
    height: 6,
    width: 120,
    borderRadius: 3,
    overflow: 'hidden',
  },
  heatScaleSegment: {
    flex: 1,
    height: '100%',
  },
  heatScaleLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.text, fontSize: 11, fontWeight: '600' },

  // Sub-Tab Switcher: [ RECENT EXERCISES ] [ MUSCLES ]
  subTabRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    marginTop: spacing.xs,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subTabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Weekly Muscles Cards Styling
  recoverySummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,107,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  recoverySummaryText: {
    fontSize: 10,
    fontWeight: '800',
  },

  muscleCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  muscleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  muscleTitleCol: {
    flex: 1,
    gap: 2,
  },
  muscleCardName: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  muscleCardSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  muscleCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recoveryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  recoveryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  muscleExpandedBody: {
    gap: spacing.sm,
    marginTop: 2,
  },
  muscleDivider: {
    height: 1,
    marginVertical: 2,
  },
  muscleSectionSubHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  recoveryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recoveryProgressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  recoveryProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  recentExRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  recentExName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  recentExSet: {
    fontSize: 11,
    fontWeight: '800',
  },
  recentExEmpty: {
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 2,
  },

  // Workout History Premium Cards
  historySectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  seeAllLink: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  workoutPremiumCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 10 },
  workoutCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workoutTitleCol: { gap: 2 },
  workoutName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  workoutDate: { color: colors.textMuted, fontSize: 12 },
  volBadge: { backgroundColor: 'rgba(72,187,149,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  volBadgeVal: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  workoutCardDivider: { height: 1, backgroundColor: colors.border },
  workoutCardBottom: { flexDirection: 'row', gap: spacing.lg },
  workoutStatCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  workoutStatVal: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  emptyBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 18 },

  searchRow: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  searchInput: { flex: 1, paddingVertical: 11, color: colors.text, fontSize: 15 },

  // Premium Exercise Cards (1RM & mini progress line)
  exercisePremiumCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 12, marginBottom: spacing.sm },
  exCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exThumbnail: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: 'rgba(72,187,149,0.15)', alignItems: 'center', justifyContent: 'center' },
  exThumbText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  exDetails: { flex: 1, gap: 2 },
  exTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  exSubtitle: { color: colors.textMuted, fontSize: 11, textTransform: 'capitalize' },
  exPrRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: spacing.lg },
  prBox: { flex: 1, gap: 2 },
  prLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  prValue: { color: colors.text, fontSize: 13, fontWeight: '800' },

  // Measures Tab Redesign Layout
  measuresActionRow: { paddingBottom: spacing.xs },
  logCTA: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  logCTAText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },

  createGoalRowBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(72,187,149,0.06)', borderWidth: 1, borderColor: 'rgba(72,187,149,0.2)', borderRadius: radius.md, padding: spacing.md },
  createGoalRowText: { flex: 1, color: colors.primary, fontSize: 14, fontWeight: '700' },

  goalPremiumCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 10 },
  goalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  goalLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  goalTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 1 },
  goalBodyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalDetailVal: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  goalCurrentVal: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  measuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  measureTileCard: { width: '48%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.xs },
  meaTileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', height: 28 },
  meaTitleCol: { gap: 1 },
  meaTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  meaDate: { color: colors.textMuted, fontSize: 10 },
  sparkline: { width: 60, height: 22, overflow: 'hidden', opacity: 0.8 },
  meaTileBody: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: spacing.xs },
  meaTileVal: { color: colors.text, fontSize: 22, fontWeight: '900' },
  meaTileUnit: { color: colors.primary, fontSize: 12, fontWeight: '700' },

  // Photos Tab premium empty state
  photosEmptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, minHeight: 380 },
  photosIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  photosTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  photosDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  photosCta: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: spacing.lg },
  photosCtaText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },

  // Modal styling
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '85%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  logFieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  logFieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  logFieldInput: { width: 100, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'right', paddingVertical: 0 },
  modalFooter: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  saveBtnText: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
  duoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  duoBadgeText: { color: '#60a5fa', fontSize: 11, fontWeight: '700' },
  errorContainer: { padding: spacing.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.md, gap: spacing.md, width: '100%' },
  errorText: { color: '#ef4444', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill },
  retryBtnText: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
});
