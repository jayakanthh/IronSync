import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import {
  MuscleAnatomy,
  MuscleAnatomyPair,
  type MuscleId,
  type MuscleIntensityMap,
  type MuscleEngagementMap,
  type HeatPalette,
} from '../anatomy';
import { mapRawToLovableMuscleId, normalizeSetCountsToIntensity } from '../../utils/muscleHeatmap';

export type MuscleRegion = MuscleId;

export function normalizeMuscle(name: string): MuscleId | string {
  const mapped = mapRawToLovableMuscleId(name);
  return mapped || name.toLowerCase().trim();
}

export function aggregateMusclesFromExercises(
  exercises: { muscleGroup: string; secondaryMuscles?: string[] }[]
): { primary: Set<string>; secondary: Set<string>; setCounts?: Partial<Record<MuscleId, number>> } {
  const primary = new Set<string>();
  const secondary = new Set<string>();
  const setCounts: Partial<Record<MuscleId, number>> = {};

  for (const ex of exercises) {
    const pId = mapRawToLovableMuscleId(ex.muscleGroup);
    if (pId) {
      primary.add(pId);
      setCounts[pId] = (setCounts[pId] || 0) + 4; // default set estimation if raw sets not supplied
    }
    for (const sm of ex.secondaryMuscles ?? []) {
      const sId = mapRawToLovableMuscleId(sm);
      if (sId) {
        secondary.add(sId);
        setCounts[sId] = (setCounts[sId] || 0) + 2;
      }
    }
  }
  for (const p of primary) {
    secondary.delete(p);
  }
  return { primary, secondary, setCounts };
}

export interface MuscleSilhouetteProps {
  primaryMuscles?: Set<string>;
  secondaryMuscles?: Set<string>;
  setCounts?: Partial<Record<MuscleId, number>>;
  intensity?: MuscleIntensityMap;
  engagement?: MuscleEngagementMap;
  palette?: HeatPalette;
  view?: 'front' | 'back' | 'both';
  size?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * IronSync Canonical Muscle Anatomy visualization.
 * Wraps the Lovable high-fidelity anatomical visualization and connects
 * it to IronSync's workout and theme data pipeline.
 */
export default function MuscleSilhouette({
  primaryMuscles = new Set(),
  secondaryMuscles = new Set(),
  setCounts,
  intensity: customIntensity,
  engagement: customEngagement,
  palette,
  view = 'front',
  size = 120,
  gap = 16,
  style,
}: MuscleSilhouetteProps) {
  // Derive intensity map from explicit intensity or from setCounts / primaryMuscles
  const intensityMap: MuscleIntensityMap = useMemo(() => {
    if (customIntensity) return customIntensity;

    if (setCounts && Object.keys(setCounts).length > 0) {
      return normalizeSetCountsToIntensity(setCounts);
    }

    // Fallback: derive intensity from active primary/secondary sets
    const map: MuscleIntensityMap = {};
    primaryMuscles.forEach((m) => {
      const id = mapRawToLovableMuscleId(m);
      if (id) map[id] = 0.85;
    });
    secondaryMuscles.forEach((m) => {
      const id = mapRawToLovableMuscleId(m);
      if (id && !map[id]) map[id] = 0.45;
    });
    return map;
  }, [customIntensity, setCounts, primaryMuscles, secondaryMuscles]);

  // Derive engagement map
  const engagementMap: MuscleEngagementMap = useMemo(() => {
    if (customEngagement) return customEngagement;
    const map: MuscleEngagementMap = {};
    primaryMuscles.forEach((m) => {
      const id = mapRawToLovableMuscleId(m);
      if (id) map[id] = 'primary';
    });
    secondaryMuscles.forEach((m) => {
      const id = mapRawToLovableMuscleId(m);
      if (id && !map[id]) map[id] = 'secondary';
    });
    return map;
  }, [customEngagement, primaryMuscles, secondaryMuscles]);

  if (view === 'both') {
    return (
      <MuscleAnatomyPair
        intensity={intensityMap}
        engagement={engagementMap}
        palette={palette}
        size={size}
        gap={gap}
        style={style}
      />
    );
  }

  return (
    <MuscleAnatomy
      view={view}
      intensity={intensityMap}
      engagement={engagementMap}
      palette={palette}
      size={size}
      style={style}
    />
  );
}

const styles = StyleSheet.create({});
