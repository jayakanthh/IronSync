// components/overview/MonthSelector.tsx
//
// Horizontal pill list of the last 12 months. Selecting a past month gives
// its full range; selecting the current month gives [1st, today].

import React, { useMemo } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Typography } from '../ui/Typography';
import { colors, spacing, radius } from '../../theme/colors';

export interface MonthOption {
  year: number;
  monthIndex0: number; // 0-11
  label: string; // "Aug 2026"
}

interface Props {
  selected: MonthOption;
  onSelect: (month: MonthOption) => void;
  monthsBack?: number; // how many months of history to show, default 12
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildRecentMonths(monthsBack = 12): MonthOption[] {
  const now = new Date();
  const months: MonthOption[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      monthIndex0: d.getMonth(),
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return months; // most recent first
}

export default function MonthSelector({ selected, onSelect, monthsBack = 12 }: Props) {
  const months = useMemo(() => buildRecentMonths(monthsBack), [monthsBack]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {months.map(m => {
        const isSelected = m.year === selected.year && m.monthIndex0 === selected.monthIndex0;
        return (
          <TouchableOpacity
            key={`${m.year}-${m.monthIndex0}`}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelect(m)}
          >
            <Typography
              variant="caption"
              color={isSelected ? colors.background : colors.textMuted}
              style={isSelected ? styles.textSelected : undefined}
            >
              {m.label}
            </Typography>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill ?? 999,
    backgroundColor: colors.surfaceAlt,
  },
  pillSelected: {
    backgroundColor: colors.primary,
  },
  textSelected: {
    fontWeight: '700',
  },
});