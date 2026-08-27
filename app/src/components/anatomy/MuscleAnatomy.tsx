import React, { useMemo } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Ellipse, Path, Rect } from 'react-native-svg';
import {
  ARTWORK_HEIGHT,
  ARTWORK_WIDTH,
  REGIONS_BY_VIEW,
  type AnatomyView,
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

const FRONT_ARTWORK = require('../../../assets/anatomy/anatomy-front.png');
const BACK_ARTWORK = require('../../../assets/anatomy/anatomy-back.png');

const ARTWORK: Record<AnatomyView, any> = {
  front: FRONT_ARTWORK,
  back: BACK_ARTWORK,
};

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
  /** Display width/size of the figure. Height is scaled proportionally (1024:1536 = 2:3). */
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
  const regions = REGIONS_BY_VIEW[view];
  const src = ARTWORK[view];

  // Resolve palette from active theme if not explicitly passed
  const activePalette = useMemo(() => {
    if (palette && palette.length > 0) return palette;
    const themeId = (theme as any)?.id || 'signature';
    return THEME_HEAT_PALETTES[themeId] || DEFAULT_HEAT_PALETTE;
  }, [palette, theme]);

  const fields = useMemo(() => {
    return (Object.keys(regions) as MuscleId[])
      .map((id) => {
        const raw = clamp01(intensity[id] ?? 0);
        if (raw <= 0) return null;
        const mode = engagement[id];
        // secondary work reads slightly softer, primary slightly crisper
        const bias = mode === 'secondary' ? 0.94 : mode === 'primary' ? 1.03 : 1;
        const t = clamp01(raw * bias);
        return {
          id,
          shapes: regions[id]!,
          color: sampleHeatPalette(activePalette, t),
          opacity: Math.round(heatOpacity(t, minHeatOpacity, maxHeatOpacity) * 1000) / 1000,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);
  }, [regions, intensity, engagement, activePalette, minHeatOpacity, maxHeatOpacity]);

  const widthStyle = size ? { width: size, height: size * (ARTWORK_HEIGHT / ARTWORK_WIDTH) } : styles.fullSize;

  return (
    <View
      style={[
        styles.container,
        widthStyle,
        style,
      ]}
      accessibilityLabel={title ?? `Anatomical ${view} view of an athletic male figure`}
    >
      <Image
        source={src}
        style={styles.image}
        resizeMode="contain"
      />

      <Svg
        viewBox={`0 0 ${ARTWORK_WIDTH} ${ARTWORK_HEIGHT}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {neutralColor ? (
          <Rect
            x="0"
            y="0"
            width={ARTWORK_WIDTH}
            height={ARTWORK_HEIGHT}
            fill={neutralColor}
            opacity={clamp01(neutralStrength)}
          />
        ) : null}

        <G>
          {fields.map((field) => (
            <G key={field.id} opacity={field.opacity}>
              {field.shapes.map((s, i) => (
                s.path ? (
                  <Path
                    key={i}
                    d={s.path}
                    fill={field.color}
                  />
                ) : (
                  <Ellipse
                    key={i}
                    cx={s.cx}
                    cy={s.cy}
                    rx={s.rx}
                    ry={s.ry}
                    fill={field.color}
                    transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined}
                  />
                )
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
    aspectRatio: ARTWORK_WIDTH / ARTWORK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullSize: {
    width: '100%',
    height: '100%',
  },
  image: {
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
