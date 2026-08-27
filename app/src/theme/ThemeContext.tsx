import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeId =
  | 'signature'
  | 'classic_black'
  | 'classic_white'
  | 'iron_green'
  | 'electric_blue'
  | 'cyber_purple'
  | 'batman'
  | 'hello_kitty'
  | 'iron_man';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  border: string;
  divider: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  chartColors: string[];
  progressColors: string[];
  iconColors: {
    primary: string;
    secondary: string;
  };
}

export interface ThemeShape {
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusXl: number;
  pill: number;
  shadows: any;
}

export interface ThemeTypography {
  heading: string | undefined;
  body: string | undefined;
  headingWeight: '700' | '800' | '900' | 'bold';
  letterSpacing: number;
}

export interface ThemeDecorations {
  watermark: 'signature' | 'batman' | 'hello_kitty' | 'cyber_purple' | 'iron_man' | 'none';
  motif: string;
  divider: string;
  logoTint: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  mode: ThemeMode;
  colors: ThemeColors;
  shape: ThemeShape;
  typography: ThemeTypography;
  decorations: ThemeDecorations;
}

// Custom shapes according to character and brand personalities
const defaultShape: ThemeShape = {
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 24,
  pill: 999,
  shadows: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
};

const classicBlackShape: ThemeShape = {
  radiusSm: 4,
  radiusMd: 6,
  radiusLg: 10,
  radiusXl: 14,
  pill: 999,
  shadows: defaultShape.shadows,
};

const classicWhiteShape: ThemeShape = {
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 14,
  radiusXl: 20,
  pill: 999,
  shadows: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
};

const helloKittyShape: ThemeShape = {
  radiusSm: 12,
  radiusMd: 16,
  radiusLg: 24,
  radiusXl: 32,
  pill: 999,
  shadows: {
    shadowColor: '#db2777',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
};

const batmanShape: ThemeShape = {
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 12,
  radiusXl: 16,
  pill: 999,
  shadows: defaultShape.shadows,
};

const ironManShape: ThemeShape = {
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 14,
  radiusXl: 18,
  pill: 999,
  shadows: defaultShape.shadows,
};

const defaultTypography: ThemeTypography = {
  heading: undefined,
  body: undefined,
  headingWeight: '800',
  letterSpacing: 0,
};

export const THEME_REGISTRY: Record<ThemeId, Record<ThemeMode, Theme>> = {
  signature: {
    dark: {
      id: 'signature',
      name: 'IronSync Signature',
      description: 'The official IronSync identity.',
      mode: 'dark',
      colors: {
        background: '#0c0e10',
        surface: '#16191c',
        surfaceElevated: '#202428',
        textPrimary: '#FFFFFF',
        textSecondary: '#9ca3af',
        textMuted: '#6b7280',
        primary: '#ff6b00',
        primaryForeground: '#0c0e10',
        accent: '#ff6b00',
        border: '#23282f',
        divider: '#23282f',
        success: '#48bb95',
        warning: '#f97316',
        danger: '#ff4d4f',
        info: '#3b82f6',
        chartColors: ['#ff6b00', '#48bb95', '#eab308', '#f97316'],
        progressColors: ['#ff6b00', '#48bb95', '#eab308'],
        iconColors: { primary: '#ff6b00', secondary: '#9ca3af' },
      },
      shape: defaultShape,
      typography: defaultTypography,
      decorations: { watermark: 'signature', motif: 'default', divider: 'solid', logoTint: '#ff6b00' },
    },
    light: {
      id: 'signature',
      name: 'IronSync Signature',
      description: 'The official IronSync identity.',
      mode: 'light',
      colors: {
        background: '#f8fafc',
        surface: '#ffffff',
        surfaceElevated: '#f1f5f9',
        textPrimary: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#94a3b8',
        primary: '#ff6b00',
        primaryForeground: '#ffffff',
        accent: '#ff6b00',
        border: '#e2e8f0',
        divider: '#e2e8f0',
        success: '#10b981',
        warning: '#f97316',
        danger: '#ef4444',
        info: '#3b82f6',
        chartColors: ['#ff6b00', '#10b981', '#f59e0b', '#ef4444'],
        progressColors: ['#ff6b00', '#10b981', '#f59e0b'],
        iconColors: { primary: '#ff6b00', secondary: '#64748b' },
      },
      shape: defaultShape,
      typography: defaultTypography,
      decorations: { watermark: 'signature', motif: 'default', divider: 'solid', logoTint: '#ff6b00' },
    },
  },
  classic_black: {
    dark: {
      id: 'classic_black',
      name: 'Classic Black',
      description: 'AMOLED luxury. Black, charcoal, white, grey.',
      mode: 'dark',
      colors: {
        background: '#000000',
        surface: '#0b0b0c',
        surfaceElevated: '#151518',
        textPrimary: '#ffffff',
        textSecondary: '#a1a1aa',
        textMuted: '#52525b',
        primary: '#ffffff',
        primaryForeground: '#000000',
        accent: '#ffffff',
        border: '#202023',
        divider: '#202023',
        success: '#ffffff',
        warning: '#a1a1aa',
        danger: '#ef4444',
        info: '#71717a',
        chartColors: ['#ffffff', '#a1a1aa', '#71717a', '#27272a'],
        progressColors: ['#ffffff', '#a1a1aa', '#71717a'],
        iconColors: { primary: '#ffffff', secondary: '#a1a1aa' },
      },
      shape: classicBlackShape,
      typography: { ...defaultTypography, headingWeight: '900' },
      decorations: { watermark: 'none', motif: 'none', divider: 'solid', logoTint: '#ffffff' },
    },
    light: {
      id: 'classic_black',
      name: 'Classic Black',
      description: 'AMOLED luxury. Black, charcoal, white, grey.',
      mode: 'light',
      colors: {
        background: '#ffffff',
        surface: '#fafafa',
        surfaceElevated: '#f4f4f5',
        textPrimary: '#09090b',
        textSecondary: '#71717a',
        textMuted: '#a1a1aa',
        primary: '#09090b',
        primaryForeground: '#ffffff',
        accent: '#09090b',
        border: '#e4e4e7',
        divider: '#e4e4e7',
        success: '#09090b',
        warning: '#71717a',
        danger: '#dc2626',
        info: '#a1a1aa',
        chartColors: ['#09090b', '#71717a', '#a1a1aa', '#e4e4e7'],
        progressColors: ['#09090b', '#71717a', '#a1a1aa'],
        iconColors: { primary: '#09090b', secondary: '#71717a' },
      },
      shape: classicBlackShape,
      typography: { ...defaultTypography, headingWeight: '900' },
      decorations: { watermark: 'none', motif: 'none', divider: 'solid', logoTint: '#09090b' },
    },
  },
  classic_white: {
    dark: {
      id: 'classic_white',
      name: 'Classic White',
      description: 'Clean light-graphite design with high contrast.',
      mode: 'dark',
      colors: {
        background: '#09090b',
        surface: '#18181b',
        surfaceElevated: '#27272a',
        textPrimary: '#fafafa',
        textSecondary: '#a1a1aa',
        textMuted: '#52525b',
        primary: '#ffffff',
        primaryForeground: '#09090b',
        accent: '#ffffff',
        border: '#2e2e33',
        divider: '#2e2e33',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        chartColors: ['#ffffff', '#a1a1aa', '#71717a', '#27272a'],
        progressColors: ['#ffffff', '#a1a1aa', '#71717a'],
        iconColors: { primary: '#ffffff', secondary: '#a1a1aa' },
      },
      shape: classicWhiteShape,
      typography: defaultTypography,
      decorations: { watermark: 'none', motif: 'none', divider: 'solid', logoTint: '#ffffff' },
    },
    light: {
      id: 'classic_white',
      name: 'Classic White',
      description: 'Clean light-graphite design with high contrast.',
      mode: 'light',
      colors: {
        background: '#fafafa',
        surface: '#ffffff',
        surfaceElevated: '#f4f4f5',
        textPrimary: '#18181b',
        textSecondary: '#52525b',
        textMuted: '#71717a',
        primary: '#18181b',
        primaryForeground: '#ffffff',
        accent: '#18181b',
        border: '#e4e4e7',
        divider: '#e4e4e7',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        chartColors: ['#18181b', '#52525b', '#71717a', '#e4e4e7'],
        progressColors: ['#18181b', '#52525b', '#71717a'],
        iconColors: { primary: '#18181b', secondary: '#52525b' },
      },
      shape: classicWhiteShape,
      typography: defaultTypography,
      decorations: { watermark: 'none', motif: 'none', divider: 'solid', logoTint: '#18181b' },
    },
  },
  iron_green: {
    dark: {
      id: 'iron_green',
      name: 'Iron Green',
      description: 'Deep forest with performance emerald accents.',
      mode: 'dark',
      colors: {
        background: '#060807',
        surface: '#0f1412',
        surfaceElevated: '#171f1b',
        textPrimary: '#f0fdf4',
        textSecondary: '#94a3b8',
        textMuted: '#64748b',
        primary: '#10b981',
        primaryForeground: '#060807',
        accent: '#059669',
        border: '#1b2621',
        divider: '#1b2621',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        chartColors: ['#10b981', '#059669', '#047857', '#1b2621'],
        progressColors: ['#10b981', '#059669', '#047857'],
        iconColors: { primary: '#10b981', secondary: '#94a3b8' },
      },
      shape: defaultShape,
      typography: defaultTypography,
      decorations: { watermark: 'none', motif: 'green_accent', divider: 'solid', logoTint: '#10b981' },
    },
    light: {
      id: 'iron_green',
      name: 'Iron Green',
      description: 'Deep forest with performance emerald accents.',
      mode: 'light',
      colors: {
        background: '#f0fdf4',
        surface: '#ffffff',
        surfaceElevated: '#e6f4ea',
        textPrimary: '#064e3b',
        textSecondary: '#15803d',
        textMuted: '#64748b',
        primary: '#059669',
        primaryForeground: '#ffffff',
        accent: '#10b981',
        border: '#d1e7dd',
        divider: '#d1e7dd',
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2563eb',
        chartColors: ['#059669', '#10b981', '#86efac', '#d1e7dd'],
        progressColors: ['#059669', '#10b981', '#86efac'],
        iconColors: { primary: '#059669', secondary: '#15803d' },
      },
      shape: defaultShape,
      typography: defaultTypography,
      decorations: { watermark: 'none', motif: 'green_accent', divider: 'solid', logoTint: '#059669' },
    },
  },
  electric_blue: {
    dark: {
      id: 'electric_blue',
      name: 'Electric Blue',
      description: 'Deep navy-graphite with electric cyan.',
      mode: 'dark',
      colors: {
        background: '#04060b',
        surface: '#0b111e',
        surfaceElevated: '#131c2f',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        textMuted: '#64748b',
        primary: '#3b82f6',
        primaryForeground: '#ffffff',
        accent: '#06b6d4',
        border: '#182235',
        divider: '#182235',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        chartColors: ['#3b82f6', '#06b6d4', '#1d4ed8', '#182235'],
        progressColors: ['#3b82f6', '#06b6d4', '#1d4ed8'],
        iconColors: { primary: '#3b82f6', secondary: '#94a3b8' },
      },
      shape: defaultShape,
      typography: defaultTypography,
      decorations: { watermark: 'none', motif: 'blue_glow', divider: 'solid', logoTint: '#3b82f6' },
    },
    light: {
      id: 'electric_blue',
      name: 'Electric Blue',
      description: 'Deep navy-graphite with electric cyan.',
      mode: 'light',
      colors: {
        background: '#f0f7ff',
        surface: '#ffffff',
        surfaceElevated: '#e0f2fe',
        textPrimary: '#1e3a8a',
        textSecondary: '#2563eb',
        textMuted: '#64748b',
        primary: '#2563eb',
        primaryForeground: '#ffffff',
        accent: '#06b6d4',
        border: '#d0e3ff',
        divider: '#d0e3ff',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        chartColors: ['#2563eb', '#06b6d4', '#60a5fa', '#d0e3ff'],
        progressColors: ['#2563eb', '#06b6d4', '#60a5fa'],
        iconColors: { primary: '#2563eb', secondary: '#2563eb' },
      },
      shape: defaultShape,
      typography: defaultTypography,
      decorations: { watermark: 'none', motif: 'blue_glow', divider: 'solid', logoTint: '#2563eb' },
    },
  },
  cyber_purple: {
    dark: {
      id: 'cyber_purple',
      name: 'Cyber Purple',
      description: 'Futuristic violet HUD with subtle neon glow.',
      mode: 'dark',
      colors: {
        background: '#040307',
        surface: '#0c0916',
        surfaceElevated: '#150f25',
        textPrimary: '#fdfaff',
        textSecondary: '#94a3b8',
        textMuted: '#64748b',
        primary: '#a855f7',
        primaryForeground: '#040307',
        accent: '#ec4899',
        border: '#1d1633',
        divider: '#1d1633',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        chartColors: ['#a855f7', '#ec4899', '#d946ef', '#1d1633'],
        progressColors: ['#a855f7', '#ec4899', '#d946ef'],
        iconColors: { primary: '#a855f7', secondary: '#94a3b8' },
      },
      shape: defaultShape,
      typography: defaultTypography,
      decorations: { watermark: 'cyber_purple', motif: 'neon_lines', divider: 'solid', logoTint: '#a855f7' },
    },
    light: {
      id: 'cyber_purple',
      name: 'Cyber Purple',
      description: 'Futuristic violet HUD with subtle neon glow.',
      mode: 'light',
      colors: {
        background: '#faf5ff',
        surface: '#ffffff',
        surfaceElevated: '#f3e8ff',
        textPrimary: '#581c87',
        textSecondary: '#7e22ce',
        textMuted: '#64748b',
        primary: '#7e22ce',
        primaryForeground: '#ffffff',
        accent: '#ec4899',
        border: '#ebd9fc',
        divider: '#ebd9fc',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        chartColors: ['#7e22ce', '#ec4899', '#c084fc', '#ebd9fc'],
        progressColors: ['#7e22ce', '#ec4899', '#c084fc'],
        iconColors: { primary: '#7e22ce', secondary: '#7e22ce' },
      },
      shape: defaultShape,
      typography: defaultTypography,
      decorations: { watermark: 'cyber_purple', motif: 'neon_lines', divider: 'solid', logoTint: '#7e22ce' },
    },
  },
  batman: {
    dark: {
      id: 'batman',
      name: 'Batman',
      description: 'Premium charcoal-gold. Muted luxury.',
      mode: 'dark',
      colors: {
        background: '#060608',
        surface: '#121215',
        surfaceElevated: '#1a1a1f',
        textPrimary: '#f5f5f4',
        textSecondary: '#a8a29e',
        textMuted: '#57524e',
        primary: '#d97706',
        primaryForeground: '#060608',
        accent: '#ca8a04',
        border: '#252219',
        divider: '#252219',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        chartColors: ['#ca8a04', '#a8a29e', '#57524e', '#252219'],
        progressColors: ['#ca8a04', '#a8a29e', '#57524e'],
        iconColors: { primary: '#ca8a04', secondary: '#a8a29e' },
      },
      shape: batmanShape,
      typography: {
        ...defaultTypography,
        headingWeight: 'bold',
        letterSpacing: 1,
      },
      decorations: { watermark: 'batman', motif: 'bat_wings', divider: 'gold', logoTint: '#ca8a04' },
    },
    light: {
      id: 'batman',
      name: 'Batman',
      description: 'Premium charcoal-gold. Muted luxury.',
      mode: 'light',
      colors: {
        background: '#f5f5f4',
        surface: '#ffffff',
        surfaceElevated: '#e7e5e4',
        textPrimary: '#1c1917',
        textSecondary: '#57534e',
        textMuted: '#78716c',
        primary: '#ca8a04',
        primaryForeground: '#ffffff',
        accent: '#ca8a04',
        border: '#d6d3d1',
        divider: '#d6d3d1',
        success: '#16a34a',
        warning: '#ea580c',
        danger: '#dc2626',
        info: '#2563eb',
        chartColors: ['#ca8a04', '#57534e', '#78716c', '#e7e5e4'],
        progressColors: ['#ca8a04', '#57534e', '#78716c'],
        iconColors: { primary: '#ca8a04', secondary: '#57534e' },
      },
      shape: batmanShape,
      typography: {
        ...defaultTypography,
        headingWeight: 'bold',
        letterSpacing: 1,
      },
      decorations: { watermark: 'batman', motif: 'bat_wings', divider: 'gold', logoTint: '#ca8a04' },
    },
  },
  hello_kitty: {
    dark: {
      id: 'hello_kitty',
      name: 'Hello Kitty',
      description: 'Charming warm cocoa, cherry rose, and red accents.',
      mode: 'dark',
      colors: {
        background: '#1a1013',
        surface: '#27181c',
        surfaceElevated: '#342127',
        textPrimary: '#fff1f2',
        textSecondary: '#fda4af',
        textMuted: '#f43f5e',
        primary: '#f472b6',
        primaryForeground: '#1a1013',
        accent: '#e11d48',
        border: '#44202a',
        divider: '#44202a',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#e11d48',
        info: '#3b82f6',
        chartColors: ['#f472b6', '#e11d48', '#fda4af', '#44202a'],
        progressColors: ['#f472b6', '#e11d48', '#fda4af'],
        iconColors: { primary: '#f472b6', secondary: '#fda4af' },
      },
      shape: helloKittyShape,
      typography: defaultTypography,
      decorations: { watermark: 'hello_kitty', motif: 'pink_bow', divider: 'pink', logoTint: '#f472b6' },
    },
    light: {
      id: 'hello_kitty',
      name: 'Hello Kitty',
      description: 'Charming warm cocoa, cherry rose, and red accents.',
      mode: 'light',
      colors: {
        background: '#fff1f2',
        surface: '#ffffff',
        surfaceElevated: '#ffe4e6',
        textPrimary: '#881337',
        textSecondary: '#9f1239',
        textMuted: '#db2777',
        primary: '#db2777',
        primaryForeground: '#ffffff',
        accent: '#db2777',
        border: '#ffe4e6',
        divider: '#ffe4e6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#e11d48',
        info: '#3b82f6',
        chartColors: ['#db2777', '#ffe4e6', '#fda4af', '#fbcfe8'],
        progressColors: ['#db2777', '#fda4af', '#ffe4e6'],
        iconColors: { primary: '#db2777', secondary: '#db2777' },
      },
      shape: helloKittyShape,
      typography: defaultTypography,
      decorations: { watermark: 'hello_kitty', motif: 'pink_bow', divider: 'pink', logoTint: '#db2777' },
    },
  },
  iron_man: {
    dark: {
      id: 'iron_man',
      name: 'Iron Man',
      description: 'Graphite metallic HUD design with crimson and gold.',
      mode: 'dark',
      colors: {
        background: '#090708',
        surface: '#141011',
        surfaceElevated: '#20181a',
        textPrimary: '#f5f5f5',
        textSecondary: '#d4d4d8',
        textMuted: '#71717a',
        primary: '#dc2626',
        primaryForeground: '#facc15',
        accent: '#facc15',
        border: '#351619',
        divider: '#351619',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#dc2626',
        info: '#3b82f6',
        chartColors: ['#dc2626', '#facc15', '#b91c1c', '#351619'],
        progressColors: ['#dc2626', '#facc15', '#b91c1c'],
        iconColors: { primary: '#dc2626', secondary: '#facc15' },
      },
      shape: ironManShape,
      typography: defaultTypography,
      decorations: { watermark: 'iron_man', motif: 'arc_reactor', divider: 'gold', logoTint: '#dc2626' },
    },
    light: {
      id: 'iron_man',
      name: 'Iron Man',
      description: 'Graphite metallic HUD design with crimson and gold.',
      mode: 'light',
      colors: {
        background: '#fff5f5',
        surface: '#ffffff',
        surfaceElevated: '#fee2e2',
        textPrimary: '#7f1d1d',
        textSecondary: '#991b1b',
        textMuted: '#dc2626',
        primary: '#b91c1c',
        primaryForeground: '#fef08a',
        accent: '#eab308',
        border: '#ffd8d8',
        divider: '#ffd8d8',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#dc2626',
        info: '#3b82f6',
        chartColors: ['#b91c1c', '#eab308', '#fee2e2', '#ffd8d8'],
        progressColors: ['#b91c1c', '#eab308', '#ffd8d8'],
        iconColors: { primary: '#b91c1c', secondary: '#eab308' },
      },
      shape: ironManShape,
      typography: defaultTypography,
      decorations: { watermark: 'iron_man', motif: 'arc_reactor', divider: 'gold', logoTint: '#b91c1c' },
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeId: (id: ThemeId) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: THEME_REGISTRY.signature.dark,
  themeMode: 'dark',
  setThemeId: async () => {},
  setThemeMode: async () => {},
});

export const activeThemeTokens = {
  colors: THEME_REGISTRY.signature.dark.colors,
  shape: THEME_REGISTRY.signature.dark.shape,
  typography: THEME_REGISTRY.signature.dark.typography,
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>('signature');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const savedId = await AsyncStorage.getItem('ironsync_theme_id');
        const savedMode = await AsyncStorage.getItem('ironsync_theme_mode');
        
        if (savedId && THEME_REGISTRY[savedId as ThemeId]) {
          setThemeIdState(savedId as ThemeId);
        }
        if (savedMode && (savedMode === 'dark' || savedMode === 'light')) {
          setThemeModeState(savedMode as ThemeMode);
        }
      } catch (err) {
        console.warn('Failed to load theme preference', err);
      } finally {
        setLoading(false);
      }
    }
    loadSavedTheme();
  }, []);

  const setThemeId = async (id: ThemeId) => {
    if (THEME_REGISTRY[id]) {
      setThemeIdState(id);
      try {
        await AsyncStorage.setItem('ironsync_theme_id', id);
      } catch (err) {
        console.warn('Failed to save theme preference', err);
      }
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem('ironsync_theme_mode', mode);
    } catch (err) {
      console.warn('Failed to save theme mode preference', err);
    }
  };

  const activeTheme = THEME_REGISTRY[themeId]?.[themeMode] || THEME_REGISTRY.signature.dark;

  // Keep global variables in sync for static imports
  activeThemeTokens.colors = activeTheme.colors;
  activeThemeTokens.shape = activeTheme.shape;
  activeThemeTokens.typography = activeTheme.typography;

  if (loading) {
    return null; // Render nothing until theme resolves
  }

  return (
    <ThemeContext.Provider value={{ theme: activeTheme, themeMode, setThemeId, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
