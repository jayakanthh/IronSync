export { MuscleAnatomy, MuscleAnatomyPair, default } from './MuscleAnatomy';
export type {
  MuscleAnatomyProps,
  MuscleIntensityMap,
  MuscleEngagementMap,
} from './MuscleAnatomy';
export { MUSCLE_LABELS, pathsForMuscle, bodyOutlinePaths, getViewBox } from './muscle-regions';
export type { MuscleId, AnatomyView, BodyGender } from './muscle-regions';
export {
  DEFAULT_HEAT_PALETTE,
  THEME_HEAT_PALETTES,
  sampleHeatPalette,
  heatOpacity,
  clamp01,
} from './heat-scale';
export type { HeatPalette } from './heat-scale';
