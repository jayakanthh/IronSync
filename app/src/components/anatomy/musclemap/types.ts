/**
 * Vendored from musclemap-rn — see ./NOTICE.md.
 * Only the pieces the path data needs.
 */
export type BodyGender = 'male' | 'female';
export type BodySide = 'front' | 'back';

/** One body part: shapes drawn once, plus mirrored left/right shapes. */
export interface BodyPartPathData {
  slug: string;
  common: string[];
  left: string[];
  right: string[];
}

export interface BodyViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
