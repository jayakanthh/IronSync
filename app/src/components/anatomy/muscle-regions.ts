/**
 * Muscle regions — which drawn shapes belong to each of IronSync's muscle groups.
 *
 * The artwork is vendored path data (see ./musclemap/NOTICE.md): four hand-drawn
 * bodies, male and female, front and back. This file is the seam between their
 * slugs and the muscle vocabulary the rest of the app speaks.
 *
 * Previously this held ~54 hand-placed ellipses over a photographic render. They
 * were positioned by eye and never matched the anatomy underneath.
 */
import { getBodyPaths, getViewBox } from './musclemap';
import type { BodyGender } from './musclemap';

export type AnatomyView = 'front' | 'back';
export type { BodyGender };

export type MuscleId =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'traps'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

/** Human-readable labels for legends and tooltips. */
export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Chest',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  traps: 'Traps',
  lats: 'Lats',
  upper_back: 'Upper Back',
  lower_back: 'Lower Back',
  abs: 'Abs',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
};

/**
 * Our muscle groups to the artwork's slugs. Several map to more than one: the
 * drawing separates upper/lower chest and inner/outer quad, which we train and
 * count as one group each.
 *
 * Slugs the artwork has but we don't train — head, hair, hands, feet, ankles,
 * knees — are deliberately absent, so they render as plain body, never as heat.
 */
const SLUGS_BY_MUSCLE: Record<MuscleId, string[]> = {
  chest: ['chest', 'upper-chest', 'lower-chest'],
  front_delts: ['front-deltoid'],
  side_delts: ['deltoids'],
  rear_delts: ['rear-deltoid', 'deltoids'], // back view draws the rear head as 'deltoids'
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  traps: ['trapezius', 'upper-trapezius', 'lower-trapezius'],
  lats: ['upper-back'], // the drawing's back sheet covers lats as upper-back
  upper_back: ['upper-back', 'rhomboids'],
  lower_back: ['lower-back'],
  abs: ['abs', 'upper-abs', 'lower-abs'],
  obliques: ['obliques', 'serratus'],
  glutes: ['gluteal'],
  quads: ['quadriceps', 'inner-quad', 'outer-quad'],
  hamstrings: ['hamstring'],
  adductors: ['adductors'],
  calves: ['calves', 'tibialis'],
};

/** Every `d` string that should be painted for one muscle group in one view. */
export function pathsForMuscle(
  muscle: MuscleId,
  gender: BodyGender,
  view: AnatomyView,
): string[] {
  const wanted = new Set(SLUGS_BY_MUSCLE[muscle] ?? []);
  const out: string[] = [];
  for (const part of getBodyPaths(gender, view)) {
    if (!wanted.has(part.slug)) continue;
    out.push(...part.common, ...part.left, ...part.right);
  }
  return out;
}

/** The body itself, drawn once underneath the heat. */
export function bodyOutlinePaths(gender: BodyGender, view: AnatomyView): string[] {
  return getBodyPaths(gender, view).flatMap((p) => [...p.common, ...p.left, ...p.right]);
}

export { getViewBox };
