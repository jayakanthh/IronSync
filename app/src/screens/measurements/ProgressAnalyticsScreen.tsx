import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import {
  TrendingDown,
  Lightbulb,
  Calendar,
  History,
  ChevronRight,
  Plus,
  Scale,
  Activity,
  HeartPulse,
  AlertCircle,
  Ruler,
  Award,
  TrendingUp,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme/colors';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCurrentUser } from '../../context/CurrentUser';
import { getMeasurements, addMeasurement, getWorkoutHistory, getActiveGoal, getExercisesByIds } from '../../services/index';
import type { Measurement, Workout, Exercise } from '../../models/index';
import {
  getUnitSystem,
  convertWeightToDisplay,
  convertWeightToCanonical,
  getWeightUnit
} from '../../utils/formatting/units';

// ─── Chart Constants ─────────────────────────────────────────────────────────
const CHART_W = 300;
const CHART_H = 140;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 24;

const getX = (i: number, total: number) =>
  PAD_L + (total > 1 ? (i / (total - 1)) * (CHART_W - PAD_L - PAD_R) : (CHART_W - PAD_L - PAD_R) / 2);

type Tab = 'Weight' | 'Volume' | 'Measurements';

export default function ProgressAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refresh } = useCurrentUser();

  const [activeTab, setActiveTab] = useState<Tab>('Weight');
  const [activeTimeframe, setActiveTimeframe] = useState<'1W' | '1M' | '3M' | 'ALL'>('1M');
  const [showLogModal, setShowLogModal] = useState(false);
  const [newWeightInput, setNewWeightInput] = useState('');
  
  // Real data states
  const [measurementsList, setMeasurementsList] = useState<Measurement[]>([]);
  const [activeGoalVal, setActiveGoalVal] = useState<any>(null);
  const [workoutsList, setWorkoutsList] = useState<Workout[]>([]);
  const [exercisesList, setExercisesList] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [meas, goal, wrks] = await Promise.all([
        getMeasurements(profile.id),
        getActiveGoal(profile.id),
        getWorkoutHistory(profile.id, 30),
      ]);
      const uniqueIds = Array.from(new Set(wrks.flatMap(w => w.entries.map(e => e.exerciseId))));
      const exs = await getExercisesByIds(uniqueIds);
      setMeasurementsList(meas);
      setActiveGoalVal(goal);
      setWorkoutsList(wrks);
      setExercisesList(exs);
    } catch (e) {
      console.error('Error loading analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 1. Process Weight History for chart
  const system = getUnitSystem(profile);

  const weightHistory = useMemo(() => {
    // Sort oldest first for graph rendering
    const list = [...measurementsList]
      .filter((m) => m.weightKg)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Timeframe filtering
    const now = Date.now();
    const filtered = list.filter((m) => {
      const dateMs = new Date(m.date).getTime();
      if (activeTimeframe === '1W') return now - dateMs <= 7 * 24 * 60 * 60 * 1000;
      if (activeTimeframe === '1M') return now - dateMs <= 30 * 24 * 60 * 60 * 1000;
      if (activeTimeframe === '3M') return now - dateMs <= 90 * 24 * 60 * 60 * 1000;
      return true;
    });

    return filtered.map((m) => ({
      id: m.id,
      date: m.date,
      displayDate: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: convertWeightToDisplay(m.weightKg!, system),
    }));
  }, [measurementsList, activeTimeframe, system]);

  // Set default stepper input when profile is loaded
  useEffect(() => {
    if (profile?.weightKg) {
      setNewWeightInput(convertWeightToDisplay(profile.weightKg, system).toString());
    }
  }, [profile, system]);

  // Calculate chart boundaries
  const { minW, maxW } = useMemo(() => {
    if (weightHistory.length === 0) return { minW: 50, maxW: 100 };
    const weights = weightHistory.map((pt) => pt.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const padding = (max - min) * 0.1 || 5;
    return { minW: Math.max(0, min - padding), maxW: max + padding };
  }, [weightHistory]);

  const getY = useCallback(
    (w: number) => {
      const diff = maxW - minW;
      if (diff === 0) return PAD_T + (CHART_H - PAD_T - PAD_B) / 2;
      return PAD_T + ((maxW - w) / diff) * (CHART_H - PAD_T - PAD_B);
    },
    [minW, maxW]
  );

  // Build SVG paths for weight history
  const points = useMemo(() => {
    return weightHistory.map((pt, i) => ({
      ...pt,
      x: getX(i, weightHistory.length),
      y: getY(pt.weight),
    }));
  }, [weightHistory, getY]);

  const pathD = useMemo(() => {
    return points.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = arr[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${prev.y}, ${cx1} ${cy2}, ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length > 1) {
      return `${pathD} L ${points[points.length - 1].x} ${CHART_H - PAD_B} L ${points[0].x} ${CHART_H - PAD_B} Z`;
    }
    return '';
  }, [points, pathD]);

  // 2. Process Circumference Body Measurements
  const bodyMeasurements = useMemo(() => {
    const list = [...measurementsList].sort((a, b) => b.date.localeCompare(a.date));
    const latest = list[0];
    const secondLatest = list[1];

    const lp = latest?.bodyParts || {};
    const sp = secondLatest?.bodyParts || {};

    const parts = [
      { zone: 'Waist', key: 'waist', unit: 'in' },
      { zone: 'Chest', key: 'chest', unit: 'in' },
      { zone: 'Hips', key: 'hips', unit: 'in' },
      { zone: 'Biceps', key: 'arms', unit: 'in' },
      { zone: 'Thighs', key: 'thighs', unit: 'in' },
    ];

    return parts.map((p) => {
      const cur = lp[p.key] || null;
      const prev = sp[p.key] || null;
      const diff = cur !== null && prev !== null ? cur - prev : 0;
      return {
        zone: p.zone,
        current: cur,
        change: diff,
        unit: p.unit,
      };
    });
  }, [measurementsList]);

  // 3. Process Weekly Muscle Volume from real workouts
  const muscleVolume = useMemo(() => {
    // Muscle groups optimal target sets
    const volumeMap: Record<string, number> = {
      Chest: 0,
      Back: 0,
      Shoulders: 0,
      Biceps: 0,
      Triceps: 0,
      Legs: 0,
      Core: 0,
    };

    const exMap = new Map<string, Exercise>();
    exercisesList.forEach((e) => exMap.set(e.id, e));

    const pastWeekMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeekWorkouts = workoutsList.filter(
      (w) => new Date(w.date).getTime() >= pastWeekMs
    );

    thisWeekWorkouts.forEach((w) => {
      w.entries.forEach((entry) => {
        const ex = exMap.get(entry.exerciseId);
        if (!ex) return;
        const mg = ex.muscleGroup.toLowerCase();

        let category = 'Core';
        if (mg.includes('chest')) category = 'Chest';
        else if (mg.includes('back') || mg.includes('lats') || mg.includes('traps') || mg.includes('neck')) category = 'Back';
        else if (mg.includes('shoulder')) category = 'Shoulders';
        else if (mg.includes('bicep') || mg.includes('forearm')) category = 'Biceps';
        else if (mg.includes('tricep')) category = 'Triceps';
        else if (mg.includes('leg') || mg.includes('quad') || mg.includes('hamstring') || mg.includes('glute') || mg.includes('calves')) category = 'Legs';

        volumeMap[category] += entry.sets.length;
      });
    });

    return [
      { muscleGroup: 'Chest', weeklySets: volumeMap['Chest'], optimalRange: '12-20 sets' },
      { muscleGroup: 'Back', weeklySets: volumeMap['Back'], optimalRange: '14-22 sets' },
      { muscleGroup: 'Shoulders', weeklySets: volumeMap['Shoulders'], optimalRange: '12-18 sets' },
      { muscleGroup: 'Biceps', weeklySets: volumeMap['Biceps'], optimalRange: '10-16 sets' },
      { muscleGroup: 'Triceps', weeklySets: volumeMap['Triceps'], optimalRange: '10-16 sets' },
      { muscleGroup: 'Legs', weeklySets: volumeMap['Legs'], optimalRange: '12-20 sets' },
      { muscleGroup: 'Core', weeklySets: volumeMap['Core'], optimalRange: '8-15 sets' },
    ];
  }, [workoutsList, exercisesList]);

  const totalVolumeSets = useMemo(() => {
    return muscleVolume.reduce((sum, item) => sum + item.weeklySets, 0);
  }, [muscleVolume]);

  const goalProgressPercent = useMemo(() => {
    if (!activeGoalVal) return 0;
    const current = profile?.weightKg || activeGoalVal.startValue;
    const total = Math.abs(activeGoalVal.startValue - activeGoalVal.targetValue);
    if (total === 0) return 100;
    const done = Math.abs(activeGoalVal.startValue - current);
    return Math.min(100, Math.round((done / total) * 100));
  }, [activeGoalVal, profile]);

  const handleSaveWeight = async () => {
    const rawVal = parseFloat(newWeightInput);
    const val = convertWeightToCanonical(rawVal, system);
    if (isNaN(val) || val < 30 || val > 300) {
      const minDisplay = convertWeightToDisplay(30, system);
      const maxDisplay = convertWeightToDisplay(300, system);
      const unit = getWeightUnit(system);
      return Alert.alert('Invalid weight', `Enter a weight between ${minDisplay.toFixed(0)} and ${maxDisplay.toFixed(0)} ${unit}.`);
    }
    if (!profile || saving) return;
    
    setSaving(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await addMeasurement(profile.id, {
        date: todayStr,
        weightKg: val,
      });
      await refresh();
      await loadData();
      setShowLogModal(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save weight log.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const TABS: Tab[] = ['Weight', 'Volume', 'Measurements'];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Typography variant="h2">Progress & Analytics</Typography>
          <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
            Body Composition • Recovery • Volume
          </Typography>
        </View>
        <TouchableOpacity style={styles.logWeightBtn} onPress={() => setShowLogModal(true)}>
          <Plus size={16} color={colors.primary} />
          <Typography variant="caption" color={colors.primary} style={{ fontSize: 10 }}>Log Weight</Typography>
        </TouchableOpacity>
      </View>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Typography
              variant="caption"
              color={activeTab === tab ? colors.primary : colors.textMuted}
              style={{ fontSize: 12 }}
            >
              {tab === 'Measurements' ? '📏 Measurements' : tab}
            </Typography>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── WEIGHT TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'Weight' && (
          <>
            {weightHistory.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AlertCircle size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>Not enough data yet. Log some weight entries to display the trend graph.</Text>
              </View>
            ) : (
              <Card style={styles.chartCard}>
                <View style={styles.chartTopRow}>
                  <View>
                    <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 9 }}>CURRENT WEIGHT</Typography>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Typography variant="h1">{profile.weightKg || '—'}</Typography>
                      <Typography variant="body" color={colors.textMuted}>kg</Typography>
                    </View>
                  </View>
                  <View style={styles.timeframePills}>
                    {['1W', '1M', '3M', 'ALL'].map((tf) => (
                      <TouchableOpacity
                        key={tf}
                        style={[styles.tfPill, activeTimeframe === tf && styles.tfPillActive]}
                        onPress={() => {
                          setActiveTimeframe(tf as any);
                          setSelectedPoint(null);
                        }}
                      >
                        <Typography variant="caption" color={activeTimeframe === tf ? colors.primary : colors.textMuted} style={{ fontSize: 9 }}>
                          {tf}
                        </Typography>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* SVG Graph */}
                <View style={styles.svgWrapper}>
                  {selectedPoint && (
                    <View style={[styles.tooltip, { left: Math.min(CHART_W - 120, Math.max(10, selectedPoint.x - 50)) }]}>
                      <Typography style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                        {selectedPoint.weight} kg
                      </Typography>
                      <Typography style={{ color: colors.textMuted, fontSize: 9, marginLeft: 4 }}>
                        ({selectedPoint.displayDate})
                      </Typography>
                    </View>
                  )}
                  <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
                    <Defs>
                      <SvgGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={colors.primary} stopOpacity={0.2} />
                        <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
                      </SvgGradient>
                    </Defs>

                    {/* Target Weight dashed line */}
                    {activeGoalVal && (
                      <>
                        <Line
                          x1={PAD_L}
                          y1={getY(activeGoalVal.targetValue)}
                          x2={CHART_W - PAD_R}
                          y2={getY(activeGoalVal.targetValue)}
                          stroke={colors.milestone}
                          strokeWidth={1}
                          strokeDasharray="4,4"
                        />
                        <SvgText
                          x={PAD_L + 4}
                          y={getY(activeGoalVal.targetValue) - 4}
                          fill={colors.milestone}
                          fontSize="8"
                          fontWeight="700"
                        >
                          TARGET: {activeGoalVal.targetValue} kg
                        </SvgText>
                      </>
                    )}

                    {/* Area under curve */}
                    {areaD ? <Path d={areaD} fill="url(#grad)" /> : null}

                    {/* Actual trend line */}
                    {pathD ? <Path d={pathD} stroke={colors.primary} strokeWidth={2.5} fill="none" /> : null}

                    {/* Interactive dots */}
                    {points.map((pt, i) => (
                      <Circle
                        key={pt.id}
                        cx={pt.x}
                        cy={pt.y}
                        r={selectedPoint?.id === pt.id ? 5 : 3.5}
                        fill={selectedPoint?.id === pt.id ? colors.primary : colors.surface}
                        stroke={colors.primary}
                        strokeWidth={2}
                        onPress={() => setSelectedPoint(pt)}
                      />
                    ))}
                  </Svg>
                </View>

                {/* Insight block */}
                <View style={styles.insightBox}>
                  <View style={styles.insightIconBox}>
                    <TrendingDown size={14} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodyBold" style={{ fontSize: 12 }}>Pacing deficits</Typography>
                    <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10, lineHeight: 14 }}>
                      Your weight trajectory is mapped in real-time. Keep logging measurements to sustain predictions.
                    </Typography>
                  </View>
                </View>
              </Card>
            )}

            {/* Goal Ring Progress */}
            {activeGoalVal && (
              <Card style={styles.goalCard}>
                <View style={styles.goalRingWrapper}>
                  <Svg width={72} height={72} viewBox="0 0 36 36">
                    <Circle cx="18" cy="18" r="16" fill="none" stroke={colors.border} strokeWidth="3" />
                    <Circle
                      cx="18" cy="18" r="16" fill="none"
                      stroke={colors.primary} strokeWidth="3"
                      strokeDasharray={`${goalProgressPercent}, 100`}
                      strokeLinecap="round"
                      rotation="-90" origin="18,18"
                    />
                  </Svg>
                  <View style={styles.goalRingText}>
                    <Typography variant="caption" color={colors.text} style={{ fontSize: 11, fontWeight: '900' }}>
                      {goalProgressPercent}%
                    </Typography>
                    <Typography style={{ color: colors.textMuted, fontSize: 8 }}>GOAL</Typography>
                  </View>
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 9 }}>ACTIVE WEIGHT GOAL</Typography>
                  <Typography variant="bodyBold">Reach {activeGoalVal.targetValue} kg</Typography>
                  <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                    Started at {activeGoalVal.startValue} kg · {Math.max(1, Math.round((activeGoalVal.targetDate - activeGoalVal.startDate) / (24 * 60 * 60 * 1000)))} days target
                  </Typography>
                </View>
              </Card>
            )}
          </>
        )}

        {/* ── VOLUME TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'Volume' && (
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Typography variant="h2" style={{ fontSize: 15 }}>Volume Analytics</Typography>
                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                  Weekly Muscle Volume Heatmap
                </Typography>
              </View>
              <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                {totalVolumeSets} Sets Total
              </Typography>
            </View>

            {muscleVolume.map((mv, idx) => {
              const fillPct = Math.min(100, (mv.weeklySets / 20) * 100);
              const barColor = fillPct > 80 ? '#f59e0b' : fillPct > 50 ? '#06b6d4' : '#34d399';
              return (
                <View key={idx} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="bodyBold" style={{ fontSize: 12 }}>{mv.muscleGroup}</Typography>
                    <Typography variant="caption" style={{ fontSize: 11 }}>
                      <Typography variant="caption" color={barColor} style={{ fontWeight: '800', fontSize: 11 }}>{mv.weeklySets} sets </Typography>
                      <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>({mv.optimalRange})</Typography>
                    </Typography>
                  </View>
                  <View style={styles.volumeTrack}>
                    <View style={[styles.volumeFill, { width: `${fillPct}%` as any, backgroundColor: barColor }]} />
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* ── MEASUREMENTS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'Measurements' && (
          <>
            <View style={styles.measurementsHeader}>
              <View style={styles.measurementIconBox}>
                <Ruler size={18} color="#06b6d4" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Typography variant="h2" style={{ fontSize: 15 }}>Circumference Tracking</Typography>
                  <View style={styles.trendBadge}>
                    <Typography style={{ color: '#7dd3fc', fontSize: 8, fontWeight: '900' }}>TREND GRAPH</Typography>
                  </View>
                </View>
                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10, marginTop: 2 }}>
                  Log chest, waist, and biceps logs in Me Stack.
                </Typography>
              </View>
            </View>

            <Card style={{ paddingHorizontal: 0, paddingVertical: spacing.xs }}>
              {bodyMeasurements.map((m, idx) => {
                const isDown = m.change < 0;
                const changeColor = m.change === 0 ? colors.textMuted : isDown ? colors.primary : '#ef4444';
                
                return (
                  <View key={idx} style={[styles.measurementCard, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={styles.measurementCardLeft}>
                      <Typography variant="bodyBold" style={{ fontSize: 15 }}>{m.zone}</Typography>
                      <Typography variant="caption" color={colors.textMuted}>
                        Current: {m.current ? `${m.current} ${m.unit}` : 'Not logged'}
                      </Typography>
                    </View>
                    {m.current !== null && m.change !== 0 && (
                      <View style={[styles.changeBadge, { backgroundColor: isDown ? 'rgba(72,187,149,0.1)' : 'rgba(239,68,68,0.1)', borderColor: isDown ? 'rgba(72,187,149,0.3)' : 'rgba(239,68,68,0.3)' }]}>
                        <Typography style={{ color: changeColor, fontSize: 11, fontWeight: '800' }}>
                          {isDown ? '↓' : '↑'} {Math.abs(m.change)} {m.unit}
                        </Typography>
                        <Typography style={{ color: changeColor, fontSize: 9 }}>this month</Typography>
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>

      {/* ── Log Weight Modal ──────────────────────────────────────────────── */}
      <Modal visible={showLogModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.logModal}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Scale size={20} color={colors.primary} />
              <Typography variant="h2" style={{ fontSize: 16 }}>Log Today's Weight</Typography>
            </View>

            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11, marginBottom: 6 }}>Weight ({getWeightUnit(system)})</Typography>
            <TextInput
              style={styles.weightInput}
              keyboardType="decimal-pad"
              value={newWeightInput}
              onChangeText={setNewWeightInput}
              placeholder="e.g. 103.2"
              placeholderTextColor={colors.textMuted}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLogModal(false)}>
                <Typography variant="body" color={colors.textMuted}>Cancel</Typography>
              </TouchableOpacity>
              <Button variant="primary" label="Save" style={{ flex: 1 }} isLoading={saving} onPress={handleSaveWeight} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  logWeightBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(72,187,149,0.1)', borderColor: 'rgba(72,187,149,0.3)', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  tabScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  tabPillActive: { backgroundColor: 'rgba(72,187,149,0.1)', borderColor: colors.primary },
  content: { padding: 16, gap: 16, paddingBottom: 100 },
  chartCard: { gap: 14 },
  chartTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  timeframePills: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 2, borderWidth: 1, borderColor: colors.border },
  tfPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.md },
  tfPillActive: { backgroundColor: 'rgba(72,187,149,0.15)' },
  svgWrapper: { position: 'relative' },
  tooltip: { position: 'absolute', top: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f262b', borderWidth: 1, borderColor: 'rgba(72,187,149,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md, zIndex: 10 },
  insightBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#15231e', borderWidth: 1, borderColor: '#214337', borderRadius: radius.md, padding: 10 },
  insightIconBox: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1b382d', alignItems: 'center', justifyContent: 'center' },
  goalCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  goalRingWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  goalRingText: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  volumeTrack: { height: 7, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  volumeFill: { height: '100%', borderRadius: 4 },
  measurementsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(6,182,212,0.08)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)', borderRadius: radius.lg, padding: 14 },
  measurementIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(6,182,212,0.15)', alignItems: 'center', justifyContent: 'center' },
  trendBadge: { backgroundColor: 'rgba(6,182,212,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  measurementCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  measurementCardLeft: { gap: 2 },
  changeBadge: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end', padding: 16 },
  logModal: { backgroundColor: '#171b1f', borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: '#28323a', marginBottom: 16 },
  weightInput: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 20, fontWeight: '800' },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingVertical: 12 },
  emptyContainer: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 16 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
