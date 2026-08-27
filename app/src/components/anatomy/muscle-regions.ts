/**
 * Muscle region map for the standalone anatomy visualization.
 *
 * Coordinates are expressed in the artwork's own pixel space
 * (1024 x 1536), calibrated directly to anatomy-front.png and anatomy-back.png.
 */

export const ARTWORK_WIDTH = 1024;
export const ARTWORK_HEIGHT = 1536;

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

export type AnatomyView = 'front' | 'back';

/** cx, cy, rx, ry, rotation (deg), or SVG path d. */
export interface FieldShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot?: number;
  path?: string;
}

export interface RegionData {
  shapes: FieldShape[];
  paths?: string[];
}

export type RegionMap = Partial<Record<MuscleId, FieldShape[]>>;

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

export const MUSCLE_IDS = Object.keys(MUSCLE_LABELS) as MuscleId[];

/** Anterior view precise muscle regions (aligned to 1024x1536 anatomy-front.png). */
export const FRONT_REGIONS: RegionMap = {
  traps: [
    { cx: 455, cy: 265, rx: 54, ry: 24, rot: -18 },
    { cx: 569, cy: 265, rx: 54, ry: 24, rot: 18 },
  ],
  front_delts: [
    { cx: 372, cy: 335, rx: 42, ry: 40, rot: -10 },
    { cx: 652, cy: 335, rx: 42, ry: 40, rot: 10 },
  ],
  side_delts: [
    { cx: 332, cy: 345, rx: 28, ry: 44, rot: -12 },
    { cx: 692, cy: 345, rx: 28, ry: 44, rot: 12 },
  ],
  chest: [
    { cx: 450, cy: 395, rx: 58, ry: 48, rot: -6 },
    { cx: 574, cy: 395, rx: 58, ry: 48, rot: 6 },
  ],
  biceps: [
    { cx: 334, cy: 455, rx: 32, ry: 58, rot: -8 },
    { cx: 690, cy: 455, rx: 32, ry: 58, rot: 8 },
  ],
  triceps: [
    { cx: 298, cy: 450, rx: 20, ry: 52, rot: -10 },
    { cx: 726, cy: 450, rx: 20, ry: 52, rot: 10 },
  ],
  forearms: [
    { cx: 270, cy: 625, rx: 36, ry: 88, rot: -12 },
    { cx: 754, cy: 625, rx: 36, ry: 88, rot: 12 },
  ],
  abs: [
    { cx: 512, cy: 490, rx: 48, ry: 30 },
    { cx: 512, cy: 550, rx: 50, ry: 32 },
    { cx: 512, cy: 615, rx: 46, ry: 34 },
    { cx: 512, cy: 675, rx: 40, ry: 30 },
  ],
  obliques: [
    { cx: 430, cy: 575, rx: 28, ry: 82, rot: -8 },
    { cx: 594, cy: 575, rx: 28, ry: 82, rot: 8 },
  ],
  quads: [
    { cx: 440, cy: 890, rx: 56, ry: 135, rot: 3 },
    { cx: 584, cy: 890, rx: 56, ry: 135, rot: -3 },
    { cx: 472, cy: 980, rx: 24, ry: 40, rot: 8 },
    { cx: 552, cy: 980, rx: 24, ry: 40, rot: -8 },
  ],
  adductors: [
    { cx: 480, cy: 830, rx: 24, ry: 82, rot: 6 },
    { cx: 544, cy: 830, rx: 24, ry: 82, rot: -6 },
  ],
  calves: [
    { cx: 436, cy: 1230, rx: 38, ry: 100, rot: 2 },
    { cx: 588, cy: 1230, rx: 38, ry: 100, rot: -2 },
  ],
};

/** Posterior view precise muscle regions (aligned to 1024x1536 anatomy-back.png). */
export const BACK_REGIONS: RegionMap = {
  traps: [
    { cx: 512, cy: 280, rx: 95, ry: 55 },
    { cx: 512, cy: 390, rx: 70, ry: 58 },
  ],
  rear_delts: [
    { cx: 366, cy: 338, rx: 42, ry: 42, rot: -10 },
    { cx: 658, cy: 338, rx: 42, ry: 42, rot: 10 },
  ],
  side_delts: [
    { cx: 328, cy: 348, rx: 26, ry: 42, rot: -12 },
    { cx: 696, cy: 348, rx: 26, ry: 42, rot: 12 },
  ],
  triceps: [
    { cx: 330, cy: 455, rx: 36, ry: 70, rot: -8 },
    { cx: 694, cy: 455, rx: 36, ry: 70, rot: 8 },
  ],
  biceps: [
    { cx: 294, cy: 450, rx: 18, ry: 50, rot: -10 },
    { cx: 730, cy: 450, rx: 18, ry: 50, rot: 10 },
  ],
  forearms: [
    { cx: 268, cy: 635, rx: 36, ry: 88, rot: -12 },
    { cx: 756, cy: 635, rx: 36, ry: 88, rot: 12 },
  ],
  upper_back: [
    { cx: 445, cy: 420, rx: 48, ry: 52, rot: 12 },
    { cx: 579, cy: 420, rx: 48, ry: 52, rot: -12 },
  ],
  lats: [
    { cx: 432, cy: 535, rx: 58, ry: 95, rot: 14 },
    { cx: 592, cy: 535, rx: 58, ry: 95, rot: -14 },
  ],
  lower_back: [
    { cx: 512, cy: 645, rx: 54, ry: 52 },
  ],
  glutes: [
    { cx: 454, cy: 775, rx: 64, ry: 75, rot: -8 },
    { cx: 570, cy: 775, rx: 64, ry: 75, rot: 8 },
  ],
  hamstrings: [
    { cx: 446, cy: 980, rx: 54, ry: 110, rot: 3 },
    { cx: 578, cy: 980, rx: 54, ry: 110, rot: -3 },
  ],
  adductors: [
    { cx: 484, cy: 925, rx: 22, ry: 75, rot: 5 },
    { cx: 540, cy: 925, rx: 22, ry: 75, rot: -5 },
  ],
  calves: [
    { cx: 442, cy: 1240, rx: 42, ry: 105, rot: 2 },
    { cx: 582, cy: 1240, rx: 42, ry: 105, rot: -2 },
  ],
};

export const REGIONS_BY_VIEW: Record<AnatomyView, RegionMap> = {
  front: FRONT_REGIONS,
  back: BACK_REGIONS,
};
