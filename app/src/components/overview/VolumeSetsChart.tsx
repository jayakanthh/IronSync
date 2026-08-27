// components/overview/VolumeSetsChart.tsx
//
// Bars = sets per bucket, line = volume (weight x reps) per bucket.
// No charting library dependency - built directly on react-native-svg so it
// doesn't add anything new to your package.json.
//
// Period toggle:
//  - "monthly": buckets the last 12 calendar months
//  - "yearly":  buckets the last 6 calendar years

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Line, Circle, Path, Rect } from 'react-native-svg';
import { Typography } from '../ui/Typography';
import { colors, spacing, radius } from '../../theme/colors';

export interface ExerciseSessionLike {
  date: number; // epoch ms
  sets: number;
  volume: number; // sum of weight * reps for that session
}

interface Bucket {
  label: string;
  sets: number;
  volume: number;
}

function bucketMonthly(sessions: ExerciseSessionLike[]): Bucket[] {
  const now = new Date();
  const buckets: Bucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString(undefined, { month: 'short' });
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const inBucket = sessions.filter(s => s.date >= start && s.date <= end);
    buckets.push({
      label,
      sets: inBucket.reduce((a, s) => a + s.sets, 0),
      volume: inBucket.reduce((a, s) => a + s.volume, 0),
    });
  }
  return buckets;
}

function bucketYearly(sessions: ExerciseSessionLike[]): Bucket[] {
  const now = new Date();
  const buckets: Bucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const year = now.getFullYear() - i;
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
    const inBucket = sessions.filter(s => s.date >= start && s.date <= end);
    buckets.push({
      label: String(year),
      sets: inBucket.reduce((a, s) => a + s.sets, 0),
      volume: inBucket.reduce((a, s) => a + s.volume, 0),
    });
  }
  return buckets;
}

interface Props {
  sessions: ExerciseSessionLike[];
  height?: number;
}

export default function VolumeSetsChart({ sessions, height = 160 }: Props) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const buckets = useMemo(
    () => (period === 'monthly' ? bucketMonthly(sessions) : bucketYearly(sessions)),
    [sessions, period]
  );

  const width = 320;
  const padding = { top: 10, bottom: 22, left: 8, right: 8 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const barSlot = plotW / buckets.length;
  const barWidth = Math.min(18, barSlot * 0.5);

  const maxSets = Math.max(...buckets.map(b => b.sets), 1);
  const maxVolume = Math.max(...buckets.map(b => b.volume), 1);

  const linePoints = buckets.map((b, i) => {
    const x = padding.left + barSlot * i + barSlot / 2;
    const y = padding.top + plotH - (b.volume / maxVolume) * plotH;
    return { x, y };
  });

  const linePath = linePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <View>
      <View style={styles.toggleRow}>
        {(['monthly', 'yearly'] as const).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.toggle, period === p && styles.toggleActive]}
            onPress={() => setPeriod(p)}
          >
            <Typography
              variant="caption"
              color={period === p ? colors.background : colors.textMuted}
              style={period === p ? styles.toggleTextActive : undefined}
            >
              {p === 'monthly' ? 'Monthly' : 'Yearly'}
            </Typography>
          </TouchableOpacity>
        ))}
        <View style={styles.legendInline}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
          <Typography variant="label" color={colors.textMuted} style={styles.legendLabel}>Sets</Typography>
          <View style={styles.legendLineSwatch} />
          <Typography variant="label" color={colors.textMuted} style={styles.legendLabel}>Volume</Typography>
        </View>
      </View>

      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* baseline */}
        <Line
          x1={padding.left}
          y1={padding.top + plotH}
          x2={width - padding.right}
          y2={padding.top + plotH}
          stroke={colors.border}
          strokeWidth={1}
        />

        {/* sets bars */}
        {buckets.map((b, i) => {
          const x = padding.left + barSlot * i + (barSlot - barWidth) / 2;
          const barHeight = Math.max(2, (b.sets / maxSets) * plotH);
          const y = padding.top + plotH - barHeight;
          return (
            <Rect
              key={`bar-${i}`}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={3}
              fill={colors.primary}
              opacity={0.85}
            />
          );
        })}

        {/* volume line */}
        {buckets.length > 1 && <Path d={linePath} stroke={colors.text} strokeWidth={2} fill="none" />}
        {linePoints.map((p, i) => (
          <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={2.5} fill={colors.text} />
        ))}
      </Svg>

      <View style={styles.labelsRow}>
        {buckets.map((b, i) => (
          <Typography key={i} variant="label" color={colors.textMuted} style={styles.xLabel}>
            {b.label}
          </Typography>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  toggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill ?? 999,
    backgroundColor: colors.surfaceAlt,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleTextActive: {
    fontWeight: '700',
  },
  legendInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 4,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendLineSwatch: {
    width: 10,
    height: 2,
    backgroundColor: colors.text,
    marginLeft: 8,
  },
  legendLabel: {
    fontSize: 10,
    marginLeft: 3,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  xLabel: {
    fontSize: 9,
    flex: 1,
    textAlign: 'center',
  },
});