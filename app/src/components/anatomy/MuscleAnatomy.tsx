import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import {
  MUSCLE_LABELS,
  bodyOutlinePaths,
  getViewBox,
  pathsForMuscle,
  type AnatomyView,
  type BodyGender,
  type MuscleId,
} from './muscle-regions';
import {
  DEFAULT_HEAT_PALETTE,
  THEME_HEAT_PALETTES,
  clamp01,
  heatOpacity,
  sampleHeatPalette,
  type HeatPalette,
} from './heat-scale';
import { useTheme } from '../../theme/colors';

/** How solid the untrained body reads. Enough to see the anatomy, not so much
 *  that it competes with the heat painted over it. */
const BODY_FILL = 0.34;
const BODY_STROKE = 0.5;

/** Every muscle we can paint. Order is irrelevant; it's a lookup list. */
const ALL_MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleId[];

export type MuscleIntensityMap = Partial<Record<MuscleId, number>>;
export type MuscleEngagementMap = Partial<
  Record<MuscleId, 'primary' | 'secondary'>
>;

export interface MuscleAnatomyProps {
  /** Which body side to render. */
  view: AnatomyView;
  /** 0..1 heat per muscle id. Missing or 0 renders neutral. */
  intensity?: MuscleIntensityMap;
  /**
   * Optional primary/secondary info. It only nudges the field a little —
   * actual heat stays driven by the supplied intensity (i.e. training volume).
   */
  engagement?: MuscleEngagementMap;
  /** Ordered colors, coolest -> hottest. Supplied by the host theme system. */
  palette?: HeatPalette;
  /** Tint applied to the whole figure before any heat (theme neutral color). */
  neutralColor?: string;
  /** Strength of the neutral tint, 0..1. */
  neutralStrength?: number;
  /** Opacity envelope for heat fields. Keeps anatomy visible at max heat. */
  minHeatOpacity?: number;
  maxHeatOpacity?: number;
  /** Which body to draw. Follows the user's profile; defaults to male. */
  gender?: BodyGender;
  /** Display width of the figure. Height follows the artwork's aspect ratio. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Accessible description of the figure. */
  title?: string;
}

/**
 * Standalone anatomical figure with per-muscle heat.
 *
 * No app logic, no data fetching, no hover, no tooltips. It renders the
 * illustration and paints soft heat fields over the named muscle regions.
 */
export function MuscleAnatomy({
  view,
  gender = 'male',
  intensity = {},
  engagement = {},
  palette,
  neutralColor,
  neutralStrength = 0.5,
  minHeatOpacity = 0.32,
  maxHeatOpacity = 0.86,
  size,
  style,
  title,
}: MuscleAnatomyProps) {
  const { theme } = useTheme();
  const vb = getViewBox(gender, view);
  // react-native-svg misrenders a viewBox with a non-zero origin, so the box is
  // normalised to 0,0 and the paths are translated by the same amount instead.
  const shift = `translate(${-vb.x}, ${-vb.y})`;

  // Resolve palette from active theme if not explicitly passed
  const activePalette = useMemo(() => {
    if (palette && palette.length > 0) return palette;
    const themeId = (theme as any)?.id || 'signature';
    return THEME_HEAT_PALETTES[themeId] || DEFAULT_HEAT_PALETTE;
  }, [palette, theme]);

  /** The body, drawn once, so untrained muscles still read as anatomy. */
  const outline = useMemo(() => bodyOutlinePaths(gender, view), [gender, view]);

  const fields = useMemo(() => {
    return ALL_MUSCLES.map((id) => {
      const raw = clamp01(intensity[id] ?? 0);
      if (raw <= 0) return null;
      const paths = pathsForMuscle(id, gender, view);
      if (paths.length === 0) return null; // this muscle isn't visible from here
      const mode = engagement[id];
      // secondary work reads slightly softer, primary slightly crisper
      const bias = mode === 'secondary' ? 0.94 : mode === 'primary' ? 1.03 : 1;
      const t = clamp01(raw * bias);
      return {
        id,
        paths,
        color: sampleHeatPalette(activePalette, t),
        opacity: Math.round(heatOpacity(t, minHeatOpacity, maxHeatOpacity) * 1000) / 1000,
      };
    }).filter((f): f is NonNullable<typeof f> => f !== null);
  }, [gender, view, intensity, engagement, activePalette, minHeatOpacity, maxHeatOpacity]);

  const widthStyle = size ? { width: size, height: size * (vb.height / vb.width) } : styles.fullSize;

  return (
    <View
      style={[styles.container, widthStyle, style]}
      accessibilityLabel={title ?? `Anatomical ${view} view showing which muscles you've trained`}
    >
      <Svg viewBox={`0 0 ${vb.width} ${vb.height}`} style={StyleSheet.absoluteFill}>
        <G transform={shift}>
          {/* The figure itself. */}
          {outline.map((d, i) => (
            <Path
              key={`body-${i}`}
              d={d}
              // surfaceElevated sat a few shades from the card it's drawn on, so
              // the figure was invisible. textSecondary is the one colour every
              // theme guarantees reads against its own background — light on the
              // dark themes, dark on the light ones.
              fill={neutralColor ?? theme.colors.textSecondary}
              fillOpacity={clamp01(neutralStrength) * BODY_FILL}
              stroke={theme.colors.textSecondary}
              strokeOpacity={BODY_STROKE}
              strokeWidth={1.6}
            />
          ))}

          {/* Heat, painted over the muscles that were actually worked. */}
          {fields.map((field) => (
            <G key={field.id} opacity={field.opacity}>
              {field.paths.map((d, i) => (
                <Path key={i} d={d} fill={field.color} />
              ))}
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
}

/** Convenience wrapper: front and back at identical scale, feet aligned. */
export function MuscleAnatomyPair(
  props: Omit<MuscleAnatomyProps, 'view'> & { gap?: number },
) {
  const { gap = 16, size, style, ...rest } = props;
  return (
    <View style={[styles.pairRow, { gap }, style]}>
      <View style={styles.pairItem}>
        <MuscleAnatomy {...rest} size={size} view="front" />
      </View>
      <View style={styles.pairItem}>
        <MuscleAnatomy {...rest} size={size} view="back" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullSize: {
    width: '100%',
    height: '100%',
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  pairItem: {
    flex: 1,
    alignItems: 'center',
  },
});

export default MuscleAnatomy;
