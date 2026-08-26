// utils/muscleHeatmap.ts
//
// Turns a list of workouts (with entries referencing exercises) into a
// per-muscle-group set count for a date range, then normalizes that into
// 0..1 intensities for MuscleAnatomy.

import type { Exercise } from '../models/index';
import type { MuscleGroupId, MuscleSetCounts, MuscleIntensities } from '../types/muscle';
import { ALL_MUSCLE_GROUPS, emptyMuscleSetCounts } from '../types/muscle';
import type { MuscleId, MuscleIntensityMap } from '../components/anatomy';

// Maps raw strings (from Exercise.muscleGroup or secondaryMuscles) to Lovable MuscleId
export function mapRawToLovableMuscleId(raw: string): MuscleId | null {
  const n = (raw || '').toLowerCase().trim();
  if (n.includes('chest') || n.includes('pec')) return 'chest';
  if (n.includes('front delt') || n.includes('anterior delt')) return 'front_delts';
  if (n.includes('rear delt') || n.includes('posterior delt')) return 'rear_delts';
  if (n.includes('side delt') || n.includes('lateral delt')) return 'side_delts';
  if (n === 'shoulders' || n.includes('shoulder') || n.includes('delt')) return 'front_delts';
  if (n.includes('trap') || n.includes('neck')) return 'traps';
  if (n.includes('bicep') || n.includes('brachialis')) return 'biceps';
  if (n.includes('tricep')) return 'triceps';
  if (n.includes('forearm') || n.includes('wrist') || n.includes('grip')) return 'forearms';
  if (n.includes('abdom') || n.includes('abs') || n.includes('core')) return 'abs';
  if (n.includes('oblique') || n.includes('serratus')) return 'obliques';
  if (n.includes('upper back') || n.includes('mid back') || n.includes('rhomboid') || n.includes('teres')) return 'upper_back';
  if (n.includes('lat')) return 'lats';
  if (n.includes('lower back') || n.includes('spine') || n.includes('erector')) return 'lower_back';
  if (n.includes('back')) return 'lats';
  if (n.includes('glute') || n.includes('buttock')) return 'glutes';
  if (n.includes('adductor') || n.includes('inner thigh')) return 'adductors';
  if (n.includes('quad') || n.includes('thigh') || n.includes('sartorius')) return 'quads';
  if (n.includes('hamstring') || n.includes('biceps femoris')) return 'hamstrings';
  if (n.includes('calf') || n.includes('calve') || n.includes('gastro') || n.includes('soleus') || n.includes('tibialis')) return 'calves';
  return null;
}

const MUSCLE_GROUP_ALIASES: Array<{ match: (s: string) => boolean; groups: MuscleGroupId[] }> = [
  { match: s => s.includes('chest') || s.includes('pec'), groups: ['chest'] },
  { match: s => s.includes('front delt') || s.includes('anterior delt'), groups: ['front_delts'] },
  { match: s => s.includes('rear delt') || s.includes('posterior delt'), groups: ['rear_delts'] },
  { match: s => s === 'shoulders' || s.includes('shoulder') || s.includes('delt'), groups: ['front_delts', 'rear_delts'] },
  { match: s => s.includes('trap'), groups: ['traps'] },
  { match: s => s.includes('bicep'), groups: ['biceps'] },
  { match: s => s.includes('tricep'), groups: ['triceps'] },
  { match: s => s.includes('forearm'), groups: ['forearms'] },
  { match: s => s.includes('ab') || s.includes('core'), groups: ['abs'] },
  { match: s => s.includes('oblique'), groups: ['obliques'] },
  { match: s => s.includes('lat'), groups: ['lats'] },
  { match: s => s.includes('lower back') || s.includes('erector'), groups: ['lower_back'] },
  { match: s => s === 'back' || s.includes('upper back') || s.includes('mid back'), groups: ['lats', 'traps'] },
  { match: s => s.includes('glute'), groups: ['glutes'] },
  { match: s => s.includes('quad'), groups: ['quads'] },
  { match: s => s.includes('hamstring'), groups: ['hamstrings'] },
  { match: s => s.includes('adductor') || s.includes('inner thigh'), groups: ['adductors'] },
  { match: s => s === 'legs' || s.includes('leg'), groups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { match: s => s.includes('calf') || s.includes('calve'), groups: ['calves'] },
];

export function resolveMuscleGroups(exercise: Exercise): MuscleGroupId[] {
  const raw = (exercise.muscleGroup || '').toLowerCase().trim();
  if (!raw) return [];
  for (const alias of MUSCLE_GROUP_ALIASES) {
    if (alias.match(raw)) return alias.groups;
  }
  return [];
}

export interface WorkoutEntryLike {
  exerciseId: string;
  sets: Array<{ reps?: number; weight?: number; weightKg?: number }> | number;
}

export interface WorkoutLike {
  createdAt: number;
  entries: WorkoutEntryLike[];
}

function countSets(entry: WorkoutEntryLike): number {
  if (typeof entry.sets === 'number') return entry.sets;
  return Array.isArray(entry.sets) ? entry.sets.length : 0;
}

/**
 * Sums sets-per-muscle-group across every workout in `workouts` that falls
 * within [startMs, endMs].
 */
export function aggregateMuscleSets(
  workouts: WorkoutLike[],
  exerciseMap: Map<string, Exercise>,
  startMs: number,
  endMs: number
): MuscleSetCounts {
  const counts = emptyMuscleSetCounts();

  for (const workout of workouts) {
    if (workout.createdAt < startMs || workout.createdAt > endMs) continue;

    for (const entry of workout.entries) {
      const exercise = exerciseMap.get(entry.exerciseId);
      if (!exercise) continue;

      const groups = resolveMuscleGroups(exercise);
      if (groups.length === 0) continue;

      const sets = countSets(entry);
      const perGroup = sets / groups.length;
      groups.forEach(g => {
        counts[g] += perGroup;
      });
    }
  }

  ALL_MUSCLE_GROUPS.forEach(g => {
    counts[g] = Math.round(counts[g] * 10) / 10;
  });

  return counts;
}

/**
 * Normalizes raw set counts into 0..1 intensities for MuscleAnatomy.
 * Uses soft non-linear scaling with a baseline cap (e.g. 16-24 sets is high intensity)
 * so high volume reads boldly without wiping out moderate volume.
 */
export function normalizeSetCountsToIntensity(
  setCounts: Partial<Record<MuscleId, number>>
): MuscleIntensityMap {
  const intensityMap: MuscleIntensityMap = {};
  const values = Object.values(setCounts).filter((n): n is number => typeof n === 'number');
  const maxSets = values.length > 0 ? Math.max(...values, 0) : 0;
  
  if (maxSets === 0) return intensityMap;

  // Reference volume ceiling for full heat (e.g. 16-24 sets in a month is 1.0)
  const ceiling = Math.max(12, Math.min(24, maxSets));

  for (const [id, count] of Object.entries(setCounts)) {
    if (typeof count === 'number' && count > 0) {
      const ratio = Math.min(1, count / ceiling);
      const intensity = Math.round((0.25 + 0.75 * Math.pow(ratio, 0.75)) * 100) / 100;
      intensityMap[id as MuscleId] = Math.max(0, Math.min(1, intensity));
    }
  }

  return intensityMap;
}

export function normalizeIntensities(counts: MuscleSetCounts): MuscleIntensities {
  const max = Math.max(...ALL_MUSCLE_GROUPS.map(g => counts[g]), 0);
  const result = {} as MuscleIntensities;
  ALL_MUSCLE_GROUPS.forEach(g => {
    result[g] = max > 0 ? counts[g] / max : 0;
  });
  return result;
}

export function getMonthRange(year: number, monthIndex0: number): { startMs: number; endMs: number } {
  const now = Date.now();
  const start = new Date(year, monthIndex0, 1, 0, 0, 0, 0).getTime();
  const isCurrentMonth = year === new Date().getFullYear() && monthIndex0 === new Date().getMonth();
  const end = isCurrentMonth
    ? now
    : new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999).getTime();
  return { startMs: start, endMs: end };
}