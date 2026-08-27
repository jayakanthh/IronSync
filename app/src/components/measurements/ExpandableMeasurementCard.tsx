import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ChevronDown, ChevronUp, Target, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react-native';
import { radius, spacing, useTheme } from '../../theme/colors';
import type { MeasurementEntry, MeasurementGoal, MeasurementType } from '../../models/measurement';
import type { UnitSystem } from '../../utils/formatting/units';
import {
  convertWeightToDisplay,
  convertCmToDisplay,
  getWeightUnit,
  getMeasurementUnit,
} from '../../utils/formatting/units';
import MeasurementProgressGraph, { type TimeRange } from './MeasurementProgressGraph';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch (_) {}
}

export interface MeasTileDef {
  type: MeasurementType;
  label: string;
  unit: string;
}

interface Props {
  tile: MeasTileDef;
  entries: MeasurementEntry[];
  goal?: MeasurementGoal | null;
  system: UnitSystem;
  isExpanded: boolean;
  onToggle: () => void;
  onSetGoal?: (metricType: MeasurementType) => void;
}

function convertVal(val: number, metricType: MeasurementType, system: UnitSystem): number {
  if (metricType === 'weight') return convertWeightToDisplay(val, system);
  if (metricType === 'body_fat') return Math.round(val * 10) / 10;
  return convertCmToDisplay(val, system);
}

export default function ExpandableMeasurementCard({
  tile,
  entries,
  goal,
  system,
  isExpanded,
  onToggle,
  onSetGoal,
}: Props) {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');

  const unit = useMemo(() => {
    if (tile.type === 'weight') return getWeightUnit(system);
    if (tile.type === 'body_fat') return '%';
    return getMeasurementUnit(system);
  }, [tile.type, system]);

  // Latest entry
  const latestEntry = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    return entries[entries.length - 1];
  }, [entries]);

  const displayLatestVal = useMemo(() => {
    if (!latestEntry || typeof latestEntry.value !== 'number') return '—';
    return convertVal(latestEntry.value, tile.type, system).toString();
  }, [latestEntry, tile.type, system]);

  // History sorted newest first
  const historyDesc = useMemo(() => {
    return [...entries].sort((a, b) => b.recordedAt - a.recordedAt);
  }, [entries]);

  // Progress and goal status calculations
  const goalProgress = useMemo(() => {
    if (!goal || goal.status !== 'active') return null;

    const startV = convertVal(goal.startValue, tile.type, system);
    const targetV = convertVal(goal.targetValue, tile.type, system);
    const currentV = latestEntry ? convertVal(latestEntry.value, tile.type, system) : startV;

    const totalChange = targetV - startV;
    const isLoss = totalChange < 0;

    // Progress percentage
    let progressPct = 0;
    if (Math.abs(totalChange) > 0.001) {
      const achieved = currentV - startV;
      progressPct = Math.min(100, Math.max(0, Math.round((achieved / totalChange) * 100)));
    } else {
      progressPct = 100;
    }

    // Calculate expected value at today's date
    const now = Date.now();
    const totalMs = goal.targetDate - goal.startDate || 1;
    const elapsedRatio = Math.min(1, Math.max(0, (now - goal.startDate) / totalMs));
    const expectedToday = Math.round((startV + totalChange * elapsedRatio) * 10) / 10;

    // Determine status
    let statusLabel = 'On track';
    let statusColor = theme.colors.primary;
    const diff = currentV - expectedToday;

    if (isLoss) {
      if (diff <= -0.3) {
        statusLabel = 'Ahead of expected';
        statusColor = '#10b981'; // Green
      } else if (diff <= 0.4) {
        statusLabel = 'On track';
        statusColor = theme.colors.primary;
      } else {
        statusLabel = 'Behind expected';
        statusColor = '#f59e0b'; // Amber
      }
    } else {
      if (diff >= 0.3) {
        statusLabel = 'Ahead of expected';
        statusColor = '#10b981';
      } else if (diff >= -0.4) {
        statusLabel = 'On track';
        statusColor = theme.colors.primary;
      } else {
        statusLabel = 'Behind expected';
        statusColor = '#f59e0b';
      }
    }

    return {
      startV,
      targetV,
      currentV,
      progressPct,
      expectedToday,
      statusLabel,
      statusColor,
      targetDateStr: new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
  }, [goal, latestEntry, tile.type, system, theme]);

  const handlePress = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (_) {}
    onToggle();
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isExpanded ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      {/* ── CARD HEADER (COLLAPSED & EXPANDED) ───────────────────────────────── */}
      <TouchableOpacity
        style={styles.headerRow}
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.tileLabel, { color: theme.colors.textPrimary }]}>
            {tile.label.toUpperCase()}
          </Text>
          <Text style={[styles.tileDate, { color: theme.colors.textSecondary }]}>
            {latestEntry
              ? `Logged ${new Date(latestEntry.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : 'No logs yet'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.valueGroup}>
            <Text style={[styles.tileValue, { color: theme.colors.textPrimary }]}>
              {displayLatestVal}
            </Text>
            {displayLatestVal !== '—' && (
              <Text style={[styles.tileUnit, { color: theme.colors.primary }]}>
                {unit}
              </Text>
            )}
          </View>
          <View style={[styles.chevronBadge, { backgroundColor: isExpanded ? theme.colors.surfaceElevated : 'transparent' }]}>
            {isExpanded ? (
              <ChevronUp size={18} color={theme.colors.primary} />
            ) : (
              <ChevronDown size={18} color={theme.colors.textSecondary} />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* ── EXPANDED CONTENT ────────────────────────────────────────────────── */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Goal & Progress Summary Badge */}
          {goalProgress ? (
            <View style={[styles.goalProgressCard, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
              <View style={styles.goalRowTop}>
                <View>
                  <Text style={[styles.goalSectionTitle, { color: theme.colors.textSecondary }]}>
                    GOAL PROGRESS
                  </Text>
                  <Text style={[styles.goalSpanText, { color: theme.colors.textPrimary }]}>
                    {goalProgress.startV} {unit} → {goalProgress.targetV} {unit}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${goalProgress.statusColor}20` }]}>
                  <Text style={[styles.statusPillText, { color: goalProgress.statusColor }]}>
                    {goalProgress.statusLabel}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={[styles.progressBarBg, { backgroundColor: theme.colors.surface }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${goalProgress.progressPct}%`,
                      backgroundColor: goalProgress.statusColor,
                    },
                  ]}
                />
              </View>

              <View style={styles.goalMetricsFooter}>
                <Text style={[styles.goalFooterLabel, { color: theme.colors.textSecondary }]}>
                  Target Date: <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>{goalProgress.targetDateStr}</Text>
                </Text>
                <Text style={[styles.goalFooterLabel, { color: theme.colors.primary, fontWeight: '800' }]}>
                  {goalProgress.progressPct}% Achieved
                </Text>
              </View>
            </View>
          ) : (
            onSetGoal && (
              <TouchableOpacity
                style={[styles.setGoalPrompt, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated }]}
                onPress={() => onSetGoal(tile.type)}
              >
                <Target size={14} color={theme.colors.primary} />
                <Text style={[styles.setGoalPromptText, { color: theme.colors.primary }]}>
                  Set a target goal for {tile.label}
                </Text>
              </TouchableOpacity>
            )
          )}

          {/* Expected vs Actual Chart */}
          <View style={styles.graphSection}>
            <Text style={[styles.sectionSubHeader, { color: theme.colors.textSecondary }]}>
              EXPECTED VS ACTUAL PROGRESS
            </Text>
            <MeasurementProgressGraph
              entries={entries}
              goal={goal}
              metricType={tile.type}
              unit={unit}
              system={system}
              height={175}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
          </View>

          {/* Detailed Measurement History */}
          <View style={styles.historySection}>
            <Text style={[styles.sectionSubHeader, { color: theme.colors.textSecondary }]}>
              MEASUREMENT HISTORY ({historyDesc.length})
            </Text>

            {historyDesc.length === 0 ? (
              <Text style={[styles.emptyHistoryText, { color: theme.colors.textMuted }]}>
                No measurements logged yet.
              </Text>
            ) : (
              <View style={[styles.historyTable, { borderColor: theme.colors.border }]}>
                {historyDesc.slice(0, 8).map((h, i) => {
                  const displayHVal = convertVal(h.value, tile.type, system);
                  return (
                    <View
                      key={h.id || i}
                      style={[
                        styles.historyRow,
                        i < Math.min(historyDesc.length, 8) - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.historyDate, { color: theme.colors.textPrimary }]}>
                        {new Date(h.recordedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <Text style={[styles.historyValue, { color: theme.colors.primary }]}>
                        {displayHVal} {unit}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    gap: 3,
    flex: 1,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tileDate: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  tileValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tileUnit: {
    fontSize: 11,
    fontWeight: '800',
  },
  chevronBadge: {
    padding: 4,
    borderRadius: radius.pill,
  },
  expandedBody: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  goalProgressCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 8,
  },
  goalRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  goalSectionTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  goalSpanText: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalMetricsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalFooterLabel: {
    fontSize: 10,
  },
  setGoalPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  setGoalPromptText: {
    fontSize: 11,
    fontWeight: '700',
  },
  graphSection: {
    gap: 6,
  },
  sectionSubHeader: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  historySection: {
    gap: 6,
  },
  emptyHistoryText: {
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  historyTable: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyValue: {
    fontSize: 12,
    fontWeight: '800',
  },
});
