// types/muscle.ts
//
// Canonical muscle-group ids used by the body diagram. Every region drawn in
// BodyMuscleDiagram maps to exactly one of these ids.

export type MuscleGroupId =
  | 'chest'
  | 'front_delts'
  | 'rear_delts'
  | 'traps'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'lats'
  | 'lower_back'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export const ALL_MUSCLE_GROUPS: MuscleGroupId[] = [
  'chest',
  'front_delts',
  'rear_delts',
  'traps',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'lats',
  'lower_back',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroupId, string> = {
  chest: 'Chest',
  front_delts: 'Front Delts',
  rear_delts: 'Rear Delts',
  traps: 'Traps',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  lats: 'Lats',
  lower_back: 'Lower Back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
};

// Sets performed per muscle group in the selected date range.
export type MuscleSetCounts = Record<MuscleGroupId, number>;

// 0..1 normalized intensity per muscle group, ready to feed straight into
// BodyMuscleDiagram's `intensities` prop.
export type MuscleIntensities = Record<MuscleGroupId, number>;

export function emptyMuscleSetCounts(): MuscleSetCounts {
  return ALL_MUSCLE_GROUPS.reduce((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {} as MuscleSetCounts);
}