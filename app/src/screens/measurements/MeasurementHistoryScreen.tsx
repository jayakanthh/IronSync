/**
 * MeasurementHistoryScreen
 *
 * Shows history for a single measurement type (weight, waist, etc.)
 * with 1W/1M/3M/6M/ALL time filters and the production ProgressGraph.
 *
 * Navigation param: { type: MeasurementType, unit: string }
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../theme/colors';
import { TAB_BAR_SPACE } from '../../theme/layout';
import { useCurrentUser } from '../../context/CurrentUser';
import { SimpleHeader } from '../../components/ui/SimpleHeader';
import ProgressGraph, { TimeRange } from '../../components/ui/ProgressGraph';
import { getMeasurementHistory } from '../../services/measurements/measurements';
import { computeRollingAverage } from '../../services/measurements/trend';
import type { MeasurementEntry, MeasurementType } from '../../models/measurement';
import {
  getUnitSystem,
  convertWeightToDisplay,
  convertCmToDisplay,
  getWeightUnit,
  getMeasurementUnit
} from '../../utils/formatting/units';

const TYPE_LABELS: Record<MeasurementType, string> = {
  weight: 'Weight',
  height: 'Height',
  waist: 'Waist',
  chest: 'Chest',
  bicep: 'Bicep',
  tricep: 'Tricep',
  thigh: 'Thigh',
  hips: 'Hips',
  neck: 'Neck',
  calf: 'Calf',
  forearm: 'Forearm',
  body_fat: 'Body Fat',
};

export default function MeasurementHistoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { profile } = useCurrentUser();

  const type: MeasurementType = route.params?.type ?? 'weight';
  const unit: string = route.params?.unit ?? 'kg';

  const [entries, setEntries] = useState<MeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const data = await getMeasurementHistory(profile.id, type);
    setEntries(data);
    setLoading(false);
  }, [profile, type]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <SimpleHeader title={TYPE_LABELS[type]} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const system = getUnitSystem(profile);
  const displayUnit = type === 'weight'
    ? getWeightUnit(system)
    : (type === 'body_fat' ? '%' : getMeasurementUnit(system));

  // Helper to convert single measurement values
  const convertVal = (v: number) => {
    return type === 'weight'
      ? convertWeightToDisplay(v, system)
      : (type === 'body_fat' ? v : convertCmToDisplay(v, system));
  };

  const rawPoints = entries.map((e) => ({ timestamp: e.recordedAt, value: convertVal(e.value) }));
  const trendPoints = computeRollingAverage(entries).map((p) => ({ timestamp: p.timestamp, value: convertVal(p.value) }));
  const latest = entries.length > 0 ? entries[entries.length - 1] : null;
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;
  
  const displayLatestVal = latest ? convertVal(latest.value) : null;
  const displayPrevVal = prev ? convertVal(prev.value) : null;
  const delta = displayLatestVal !== null && displayPrevVal !== null ? displayLatestVal - displayPrevVal : null;

  // Filter entries for the list based on selected time range
  const rangeMs: Record<TimeRange, number> = {
    '1W': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '6M': 180 * 24 * 60 * 60 * 1000,
    ALL: Infinity,
  };
  const cutoff = Date.now() - rangeMs[timeRange];
  const visibleEntries = [...entries]
    .filter((e) => timeRange === 'ALL' || e.recordedAt >= cutoff)
    .reverse(); // latest first

  return (
    <View style={styles.screen}>
      <SimpleHeader title={TYPE_LABELS[type]} onBack={() => navigation.goBack()} />

      <FlatList
        data={visibleEntries}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Current value hero */}
            <View style={styles.heroCard}>
              <Text style={styles.heroValue}>
                {displayLatestVal !== null ? `${displayLatestVal.toFixed(1)} ${displayUnit}` : '—'}
              </Text>
              <Text style={styles.heroLabel}>Current {TYPE_LABELS[type]}</Text>
              {delta !== null && (
                <Text
                  style={[
                    styles.heroDelta,
                    { color: delta < 0 ? colors.primary : colors.danger },
                  ]}
                >
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)} {displayUnit} from previous
                </Text>
              )}
            </View>

            {/* Production graph */}
            <ProgressGraph
              rawPoints={rawPoints}
              trendPoints={trendPoints}
              projection={[]}
              targetValue={displayLatestVal ?? 0}
              height={200}
              showTimeFilter={true}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              unit={displayUnit}
            />

            <Text style={styles.sectionLabel}>HISTORY</Text>
          </View>
        }
        renderItem={({ item }) => {
          const date = new Date(item.recordedAt);
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const itemDisplayVal = convertVal(item.value);
          return (
            <View style={styles.entryRow}>
              <Text style={styles.entryDate}>{dateStr}</Text>
              <Text style={styles.entryValue}>
                {itemDisplayVal.toFixed(1)} {displayUnit}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No {TYPE_LABELS[type].toLowerCase()} data yet</Text>
            <TouchableOpacity
              style={styles.logBtn}
              onPress={() => navigation.navigate('LogMeasurement')}
            >
              <Text style={styles.logBtnText}>Log Measurement</Text>
            </TouchableOpacity>
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
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroValue: { color: colors.text, fontSize: 36, fontWeight: '800' },
  heroLabel: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  heroDelta: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  list: { paddingBottom: TAB_BAR_SPACE },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryDate: { color: colors.textMuted, fontSize: 14 },
  entryValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  logBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  logBtnText: { color: colors.primaryDark, fontWeight: '700' },
});
