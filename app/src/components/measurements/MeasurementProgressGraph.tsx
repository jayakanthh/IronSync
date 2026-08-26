import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Svg, {
  Line,
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
  Rect,
} from 'react-native-svg';
import { radius, spacing, useTheme } from '../../theme/colors';
import type { MeasurementEntry, MeasurementGoal, MeasurementType } from '../../models/measurement';
import type { UnitSystem } from '../../utils/formatting/units';
import {
  convertWeightToDisplay,
  convertCmToDisplay,
} from '../../utils/formatting/units';

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface Props {
  entries: MeasurementEntry[];
  goal?: MeasurementGoal | null;
  metricType: MeasurementType;
  unit: string;
  system: UnitSystem;
  height?: number;
  timeRange?: TimeRange;
  onTimeRangeChange?: (r: TimeRange) => void;
}

interface Point2D {
  x: number;
  y: number;
}

interface InteractivePoint {
  timestamp: number;
  actual?: number;
  expected?: number;
  x: number;
  y: number;
}

const TIME_FILTERS: TimeRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

function buildPathD(points: Point2D[], smooth = false): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;

  if (!smooth) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }

  // Catmull-Rom to Cubic Bezier curve
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const tension = 0.35;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function convertVal(val: number, metricType: MeasurementType, system: UnitSystem): number {
  if (metricType === 'weight') {
    return convertWeightToDisplay(val, system);
  }
  if (metricType === 'body_fat') {
    return Math.round(val * 10) / 10;
  }
  return convertCmToDisplay(val, system);
}

export default function MeasurementProgressGraph({
  entries,
  goal,
  metricType,
  unit,
  system,
  height = 180,
  timeRange = '3M',
  onTimeRangeChange,
}: Props) {
  const { theme } = useTheme();
  const [internalRange, setInternalRange] = useState<TimeRange>(timeRange);
  const [svgWidth, setSvgWidth] = useState(320);
  const [selectedPoint, setSelectedPoint] = useState<InteractivePoint | null>(null);

  const activeRange = onTimeRangeChange ? timeRange : internalRange;
  const handleRangeChange = (r: TimeRange) => {
    setInternalRange(r);
    onTimeRangeChange?.(r);
    setSelectedPoint(null);
  };

  // 1. Filter actual logs by time range
  const visibleEntries = useMemo(() => {
    if (entries.length === 0) return [];
    if (activeRange === 'ALL') return entries;

    const now = Date.now();
    const msMap: Record<TimeRange, number> = {
      '1M': 30 * 24 * 60 * 60 * 1000,
      '3M': 90 * 24 * 60 * 60 * 1000,
      '6M': 180 * 24 * 60 * 60 * 1000,
      '1Y': 365 * 24 * 60 * 60 * 1000,
      ALL: Infinity,
    };
    const cutoff = now - msMap[activeRange];
    return entries.filter((e) => e.recordedAt >= cutoff);
  }, [entries, activeRange]);

  // 2. Compute display values for actual points
  const rawPoints = useMemo(() => {
    return visibleEntries.map((e) => ({
      timestamp: e.recordedAt,
      value: convertVal(e.value, metricType, system),
    }));
  }, [visibleEntries, metricType, system]);

  // 3. Compute continuous expected trajectory points from goal parameters
  const expectedPoints = useMemo(() => {
    if (!goal || goal.status !== 'active') return [];

    const startV = convertVal(goal.startValue, metricType, system);
    const targetV = convertVal(goal.targetValue, metricType, system);
    const startT = goal.startDate;
    const targetT = goal.targetDate;
    const totalMs = targetT - startT || 1;
    const totalChange = targetV - startV;

    const points: Array<{ timestamp: number; expected: number }> = [];
    const stepMs = Math.max(24 * 60 * 60 * 1000, (totalMs) / 12); // ~12 sample points across goal span

    let t = startT;
    while (t <= targetT) {
      const ratio = Math.min(1, Math.max(0, (t - startT) / totalMs));
      points.push({
        timestamp: t,
        expected: Math.round((startV + totalChange * ratio) * 10) / 10,
      });
      t += stepMs;
    }
    // Ensure target end point is strictly included
    points.push({
      timestamp: targetT,
      expected: targetV,
    });

    // Filter expected trajectory to visible range window if needed
    if (activeRange === 'ALL') return points;
    const now = Date.now();
    const msMap: Record<TimeRange, number> = {
      '1M': 30 * 24 * 60 * 60 * 1000,
      '3M': 90 * 24 * 60 * 60 * 1000,
      '6M': 180 * 24 * 60 * 60 * 1000,
      '1Y': 365 * 24 * 60 * 60 * 1000,
      ALL: Infinity,
    };
    const cutoff = now - msMap[activeRange];
    return points.filter((p) => p.timestamp >= cutoff);
  }, [goal, metricType, system, activeRange]);

  const targetDisplayVal = useMemo(() => {
    if (!goal) return null;
    return convertVal(goal.targetValue, metricType, system);
  }, [goal, metricType, system]);

  // 4. Calculate coordinate domain & range
  const allValues = useMemo(() => {
    const list: number[] = [...rawPoints.map((p) => p.value), ...expectedPoints.map((p) => p.expected)];
    if (targetDisplayVal !== null) list.push(targetDisplayVal);
    return list.filter((v) => !isNaN(v));
  }, [rawPoints, expectedPoints, targetDisplayVal]);

  const allTimestamps = useMemo(() => {
    const list: number[] = [...rawPoints.map((p) => p.timestamp), ...expectedPoints.map((p) => p.timestamp)];
    if (list.length === 0) list.push(Date.now());
    return list;
  }, [rawPoints, expectedPoints]);

  const hasData = allValues.length > 0;

  const PAD = { top: 20, right: 28, bottom: 28, left: 40 };
  const W = svgWidth;
  const H = height;
  const chartW = Math.max(10, W - PAD.left - PAD.right);
  const chartH = Math.max(10, H - PAD.top - PAD.bottom);

  const minV = hasData ? Math.floor(Math.min(...allValues) * 0.98) : 0;
  const maxV = hasData ? Math.ceil(Math.max(...allValues) * 1.02) : 100;
  const valSpan = maxV - minV || 1;

  const minT = hasData ? Math.min(...allTimestamps) : Date.now() - 86400000;
  const maxT = hasData ? Math.max(...allTimestamps, Date.now()) : Date.now();
  const timeSpan = maxT - minT || 1;

  const toX = (ts: number) => PAD.left + Math.min(chartW, Math.max(0, ((ts - minT) / timeSpan) * chartW));
  const toY = (v: number) => PAD.top + Math.min(chartH, Math.max(0, ((maxV - v) / valSpan) * chartH));

  // Map to SVG coordinates
  const actualXY: Point2D[] = useMemo(() => rawPoints.map((p) => ({ x: toX(p.timestamp), y: toY(p.value) })), [rawPoints, toX, toY]);
  const expectedXY: Point2D[] = useMemo(() => expectedPoints.map((p) => ({ x: toX(p.timestamp), y: toY(p.expected) })), [expectedPoints, toX, toY]);
  const targetY = targetDisplayVal !== null ? toY(targetDisplayVal) : null;

  // Grid tick markers
  const yTicks = useMemo(() => {
    return [0, 0.5, 1].map((r) => ({
      y: PAD.top + r * chartH,
      label: (maxV - r * valSpan).toFixed(metricType === 'body_fat' ? 1 : 0),
    }));
  }, [PAD.top, chartH, maxV, valSpan, metricType]);

  const xTicks = useMemo(() => {
    if (!hasData) return [];
    const t0 = minT;
    const tMid = minT + timeSpan / 2;
    const t1 = maxT;
    return [
      { x: toX(t0), label: new Date(t0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
      { x: toX(tMid), label: new Date(tMid).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
      { x: toX(t1), label: new Date(t1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
    ];
  }, [hasData, minT, maxT, timeSpan, toX]);

  // Interactive points list for touch detection
  const interactiveList: InteractivePoint[] = useMemo(() => {
    return rawPoints.map((p) => {
      // Find matching expected projection at this timestamp if goal active
      let expVal: number | undefined;
      if (goal && goal.status === 'active') {
        const startV = convertVal(goal.startValue, metricType, system);
        const targetV = convertVal(goal.targetValue, metricType, system);
        const totalMs = goal.targetDate - goal.startDate || 1;
        const ratio = Math.min(1, Math.max(0, (p.timestamp - goal.startDate) / totalMs));
        expVal = Math.round((startV + (targetV - startV) * ratio) * 10) / 10;
      }
      return {
        timestamp: p.timestamp,
        actual: p.value,
        expected: expVal,
        x: toX(p.timestamp),
        y: toY(p.value),
      };
    });
  }, [rawPoints, goal, metricType, system, toX, toY]);

  if (!hasData || rawPoints.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated }]}>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          No measurements logged yet in this period.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Time Range Filter Bar */}
      <View style={styles.filterRow}>
        {TIME_FILTERS.map((f) => {
          const isActive = activeRange === f;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterBtn,
                { borderColor: isActive ? theme.colors.primary : theme.colors.border, backgroundColor: isActive ? theme.colors.primary : theme.colors.surface },
              ]}
              onPress={() => handleRangeChange(f)}
            >
              <Text style={[styles.filterText, { color: isActive ? '#000000' : theme.colors.textSecondary }]}>
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* SVG Chart Container */}
      <View
        onLayout={(e: LayoutChangeEvent) => setSvgWidth(Math.max(280, e.nativeEvent.layout.width))}
        style={styles.svgWrapper}
      >
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.colors.primary} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={theme.colors.primary} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Horizontal Grid Ticks */}
          {yTicks.map((gl, i) => (
            <G key={i}>
              <Line
                x1={PAD.left}
                y1={gl.y}
                x2={W - PAD.right}
                y2={gl.y}
                stroke={theme.colors.border}
                strokeWidth={0.75}
                strokeDasharray="4 4"
                opacity={0.6}
              />
              <SvgText
                x={PAD.left - 6}
                y={gl.y + 3}
                fontSize={9}
                fontWeight="700"
                fill={theme.colors.textMuted}
                textAnchor="end"
              >
                {gl.label}
              </SvgText>
            </G>
          ))}

          {/* Target Reference Line */}
          {targetY !== null && (
            <G>
              <Line
                x1={PAD.left}
                y1={targetY}
                x2={W - PAD.right}
                y2={targetY}
                stroke={theme.colors.accent}
                strokeWidth={1.2}
                strokeDasharray="5 3"
                opacity={0.85}
              />
              <SvgText
                x={W - PAD.right + 4}
                y={targetY + 3}
                fontSize={9}
                fontWeight="900"
                fill={theme.colors.accent}
                textAnchor="start"
              >
                T
              </SvgText>
            </G>
          )}

          {/* Expected Trajectory Line (Dashed) */}
          {expectedXY.length > 1 && (
            <Path
              d={buildPathD(expectedXY, false)}
              stroke={theme.colors.textSecondary}
              strokeWidth={1.8}
              strokeDasharray="6 4"
              fill="none"
              opacity={0.7}
            />
          )}

          {/* Actual Logged Line (Solid Theme Color) */}
          {actualXY.length > 1 && (
            <Path
              d={buildPathD(actualXY, true)}
              stroke={theme.colors.primary}
              strokeWidth={2.5}
              fill="none"
            />
          )}

          {/* Actual Data Points */}
          {interactiveList.map((pt, i) => {
            const isSelected = selectedPoint?.timestamp === pt.timestamp;
            return (
              <G key={i}>
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 6 : 4}
                  fill={isSelected ? theme.colors.primary : theme.colors.surface}
                  stroke={theme.colors.primary}
                  strokeWidth={2}
                />
              </G>
            );
          })}

          {/* X-Axis Date Ticks */}
          {xTicks.map((xt, i) => (
            <SvgText
              key={i}
              x={xt.x}
              y={H - 6}
              fontSize={9}
              fontWeight="600"
              fill={theme.colors.textMuted}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            >
              {xt.label}
            </SvgText>
          ))}
        </Svg>

        {/* Touch overlay hitboxes for selecting points */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {interactiveList.map((pt, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={() => setSelectedPoint(pt)}
              style={[
                styles.pointTouchHitbox,
                { left: Math.max(0, pt.x - 18), top: Math.max(0, pt.y - 18) },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Interactive Tooltip Card on Tap */}
      {selectedPoint && (
        <View style={[styles.tooltipBox, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.primary }]}>
          <Text style={[styles.tooltipDate, { color: theme.colors.textSecondary }]}>
            {new Date(selectedPoint.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          <View style={styles.tooltipMetricsRow}>
            <Text style={[styles.tooltipMetric, { color: theme.colors.primary }]}>
              Actual: {selectedPoint.actual} {unit}
            </Text>
            {typeof selectedPoint.expected === 'number' && (
              <Text style={[styles.tooltipMetric, { color: theme.colors.textSecondary }]}>
                Expected: {selectedPoint.expected} {unit}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Chart Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
          <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Actual</Text>
        </View>
        {expectedPoints.length > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDash, { backgroundColor: theme.colors.textSecondary }]} />
            <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Expected</Text>
          </View>
        )}
        {targetDisplayVal !== null && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDash, { backgroundColor: theme.colors.accent }]} />
            <Text style={[styles.legendText, { color: theme.colors.accent }]}>Target</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    width: '100%',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 4,
  },
  filterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  svgWrapper: {
    position: 'relative',
    width: '100%',
  },
  pointTouchHitbox: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipBox: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
    marginVertical: 4,
  },
  tooltipDate: {
    fontSize: 10,
    fontWeight: '700',
  },
  tooltipMetricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tooltipMetric: {
    fontSize: 11,
    fontWeight: '800',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDash: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: spacing.md,
  },
  emptyText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
