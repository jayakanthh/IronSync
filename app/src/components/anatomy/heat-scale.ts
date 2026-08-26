/**
 * Heat scale utilities.
 *
 * The component never decides what "hot" means — the parent supplies a
 * palette (an ordered list of colors from coolest to hottest) and a
 * 0..1 intensity per muscle. Everything here is pure color math.
 */

export type HeatPalette = string[];

/** Default vibrant orange heat palette */
export const DEFAULT_HEAT_PALETTE: HeatPalette = [
  '#ffb066',
  '#ff7a1a',
  '#f03a00',
  '#ff2200',
];

/**
 * Highly distinct, perceptually ordered heat scales for all IronSync themes.
 * Each progression starts with a clear visible tint at low volume and escalates
 * to a rich, saturated, vibrant highlight at maximum volume.
 */
export const THEME_HEAT_PALETTES: Record<string, HeatPalette> = {
  signature: ['#ffb066', '#ff7a1a', '#f03a00', '#ff2200'],
  iron_green: ['#6ee7b7', '#10b981', '#059669', '#00ff87'],
  electric_blue: ['#7dd3fc', '#0ea5e9', '#2563eb', '#00e5ff'],
  cyber_purple: ['#d8b4fe', '#a855f7', '#7e22ce', '#ff00ff'],
  batman: ['#fde047', '#eab308', '#ca8a04', '#ffd700'],
  iron_man: ['#fca5a5', '#ef4444', '#b91c1c', '#fbbf24'],
  hello_kitty: ['#f9a8d4', '#f43f5e', '#e11d48', '#ff007f'],
  classic_black: ['#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff'],
  classic_white: ['#94a3b8', '#475569', '#1e293b', '#020617'],
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseColor(input: string): Rgb {
  const hex = input.trim();
  if (hex.startsWith('#')) {
    const v = hex.slice(1);
    const full =
      v.length === 3
        ? v
            .split('')
            .map((c) => c + c)
            .join('')
        : v.slice(0, 6);
    const n = Number.parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const m = hex.match(/-?\d+(\.\d+)?/g);
  if (m && m.length >= 3) {
    return { r: Number(m[0]), g: Number(m[1]), b: Number(m[2]) };
  }
  return { r: 255, g: 122, b: 26 };
}

function toCss({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Sample a palette at t (0..1) with smooth linear interpolation. */
export function sampleHeatPalette(palette: HeatPalette, t: number): string {
  const stops = palette.length > 0 ? palette : DEFAULT_HEAT_PALETTE;
  if (stops.length === 1) return stops[0]!;
  const clamped = clamp01(t);
  const pos = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = parseColor(stops[i]!);
  const b = parseColor(stops[i + 1]!);
  return toCss({
    r: a.r + (b.r - a.r) * f,
    g: a.g + (b.g - a.g) * f,
    b: a.b + (b.b - a.b) * f,
  });
}

/**
 * Opacity curve for a heat field.
 * Starts with a clean visible tint (0.35) and ramps smoothly up to
 * a vivid, high-saturation highlight (0.86) while maintaining anatomical
 * striations and muscle fiber shading underneath.
 */
export function heatOpacity(
  intensity: number,
  minOpacity = 0.32,
  maxOpacity = 0.86,
): number {
  const t = clamp01(intensity);
  // Quadratic ease-in-out ramp for clear progression across low/mid/high training volumes
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return Math.round((minOpacity + (maxOpacity - minOpacity) * eased) * 1000) / 1000;
}
