/**
 * Body artwork: four hand-drawn path sets (male/female × front/back).
 * Vendored from musclemap-rn — see NOTICE.md.
 */
import type { BodyGender, BodyPartPathData, BodySide, BodyViewBox } from './types';
import { maleFrontPaths } from './maleFrontPaths';
import { maleBackPaths } from './maleBackPaths';
import { femaleFrontPaths } from './femaleFrontPaths';
import { femaleBackPaths } from './femaleBackPaths';

export type { BodyGender, BodyPartPathData, BodySide, BodyViewBox };

export function getBodyPaths(gender: BodyGender, side: BodySide): BodyPartPathData[] {
  if (gender === 'male') return side === 'front' ? maleFrontPaths : maleBackPaths;
  return side === 'front' ? femaleFrontPaths : femaleBackPaths;
}

/**
 * Each body is drawn in its own corner of a shared canvas, so the view boxes
 * are offset. react-native-svg misrenders a non-zero viewBox origin, so the
 * renderer normalises to `0 0 w h` and translates the paths instead.
 */
export function getViewBox(gender: BodyGender, side: BodySide): BodyViewBox {
  if (gender === 'male') {
    return side === 'front'
      ? { x: 0, y: 95, width: 727, height: 1280 }
      : { x: 718, y: 95, width: 727, height: 1280 };
  }
  return side === 'front'
    ? { x: 0, y: 0, width: 650, height: 1450 }
    : { x: 823, y: 0, width: 650, height: 1450 };
}
