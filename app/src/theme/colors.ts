import { activeThemeTokens } from './ThemeContext';

export const colors = new Proxy({} as any, {
  get(_, prop) {
    if (prop === 'bg') return activeThemeTokens.colors.background;
    if (prop === 'text') return activeThemeTokens.colors.textPrimary;
    if (prop === 'textMuted') return activeThemeTokens.colors.textSecondary;
    if (prop === 'surfaceAlt') return activeThemeTokens.colors.surfaceElevated;
    if (prop === 'primaryDark') return activeThemeTokens.colors.primaryForeground;
    if (prop === 'milestone') {
      return activeThemeTokens.colors.accent || '#eab308';
    }
    return (activeThemeTokens.colors as any)[prop];
  }
});

export const radius = new Proxy({} as any, {
  get(_, prop) {
    if (prop === 'sm') return activeThemeTokens.shape.radiusSm;
    if (prop === 'md') return activeThemeTokens.shape.radiusMd;
    if (prop === 'lg') return activeThemeTokens.shape.radiusLg;
    if (prop === 'xl') return activeThemeTokens.shape.radiusXl;
    if (prop === 'pill') return activeThemeTokens.shape.pill;
    return (activeThemeTokens.shape as any)[prop];
  }
});

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = new Proxy({} as any, {
  get(_, prop) {
    if (prop === 'fontFamily') return activeThemeTokens.typography.heading;
    if (prop === 'h1') return { fontSize: 22, fontWeight: activeThemeTokens.typography.headingWeight };
    if (prop === 'h2') return { fontSize: 18, fontWeight: activeThemeTokens.typography.headingWeight };
    if (prop === 'body') return { fontSize: 14, fontWeight: '400' as const };
    if (prop === 'bodyBold') return { fontSize: 14, fontWeight: '700' as const };
    if (prop === 'caption') return { fontSize: 12, fontWeight: '600' as const };
    if (prop === 'label') return { fontSize: 11, fontWeight: '700' as const, letterSpacing: activeThemeTokens.typography.letterSpacing || 1 };
    return (activeThemeTokens.typography as any)[prop];
  }
});

export const border = new Proxy({} as any, {
  get(_, prop) {
    if (prop === 'width') return 1;
    if (prop === 'color') return activeThemeTokens.colors.border;
    return undefined;
  }
});

export { ThemeProvider, useTheme, THEME_REGISTRY } from './ThemeContext';
export type { Theme, ThemeId, ThemeMode } from './ThemeContext';