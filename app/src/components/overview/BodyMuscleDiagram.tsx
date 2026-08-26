// components/overview/BodyMuscleDiagram.tsx
//
// Standalone front/back anatomical muscle visualization powered by the canonical
// Lovable MuscleAnatomyPair engine.

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';
import { colors, spacing } from '../../theme/colors';
import type { MuscleGroupId, MuscleIntensities, MuscleSetCounts } from '../../types/muscle';
import { MUSCLE_GROUP_LABELS } from '../../types/muscle';
import { MuscleAnatomyPair, type MuscleIntensityMap } from '../anatomy';

interface Props {
  intensities: MuscleIntensities;
  setCounts?: MuscleSetCounts;
  onSelectMuscle?: (id: MuscleGroupId) => void;
}

export default function BodyMuscleDiagram({ intensities, setCounts, onSelectMuscle }: Props) {
  const [selected, setSelected] = useState<MuscleGroupId | null>(null);

  const selectedSets = useMemo(
    () => (selected && setCounts ? setCounts[selected] : undefined),
    [selected, setCounts]
  );

  return (
    <View style={styles.container}>
      <MuscleAnatomyPair intensity={intensities as MuscleIntensityMap} gap={16} />

      <View style={styles.footer}>
        <Pressable style={styles.selectedCaption} disabled={!selected}>
          {selected ? (
            <Typography variant="caption" color={colors.text}>
              {MUSCLE_GROUP_LABELS[selected]}
              {typeof selectedSets === 'number' ? `  ·  ${selectedSets} sets` : ''}
            </Typography>
          ) : (
            <Typography variant="caption" color={colors.textMuted}>Monthly Muscle Heatmap</Typography>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacing.xs,
  },
  footer: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  selectedCaption: {
    minHeight: 18,
  },
});