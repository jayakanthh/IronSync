export { MuscleAnatomy, MuscleAnatomyPair, default } from './MuscleAnatomy';
export type {
  MuscleAnatomyProps,
  MuscleIntensityMap,
  MuscleEngagementMap,
} from './MuscleAnatomy';
export {
  MUSCLE_IDS,
  MUSCLE_LABELS,
  REGIONS_BY_VIEW,
  ARTWORK_WIDTH,
  ARTWORK_HEIGHT,
} from './muscle-regions';
export type { MuscleId, AnatomyView } from './muscle-regions';
export {
  DEFAULT_HEAT_PALETTE,
  THEME_HEAT_PALETTES,
  sampleHeatPalette,
  heatOpacity,
  clamp01,
} from './heat-scale';
export type { HeatPalette } from './heat-scale';
