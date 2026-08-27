import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, Sun, Moon } from 'lucide-react-native';
import { useTheme, THEME_REGISTRY, ThemeId, ThemeMode, Theme } from '../../theme/colors';

const { width } = Dimensions.get('window');

const ThemePreview = ({ previewTheme }: { previewTheme: Theme }) => {
  const getMotifEmoji = (wm: string) => {
    if (wm === 'signature') return '⚡';
    if (wm === 'batman') return '🦇';
    if (wm === 'hello_kitty') return '🎀';
    if (wm === 'cyber_purple') return '🔮';
    if (wm === 'iron_man') return '🔆';
    return '💪';
  };

  return (
    <View style={[
      styles.previewCard, 
      { 
        backgroundColor: previewTheme.colors.surface, 
        borderColor: previewTheme.colors.border,
        borderRadius: previewTheme.shape.radiusMd,
        position: 'relative',
        overflow: 'hidden'
      }
    ]}>
      {/* Decorative emblem */}
      <Text style={{ position: 'absolute', right: 4, top: 4, opacity: 0.15, fontSize: 16 }}>
        {getMotifEmoji(previewTheme.decorations.watermark)}
      </Text>

      {/* Card Header */}
      <View style={styles.previewHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.previewTitle, { color: previewTheme.colors.textPrimary }]}>Push Split</Text>
          <Text style={{ fontSize: 7, color: previewTheme.colors.textSecondary, marginTop: 1 }}>45 min • 4 sets</Text>
        </View>
        <View style={[styles.previewBadge, { backgroundColor: previewTheme.colors.primary + '20' }]}>
          <Text style={[styles.previewBadgeText, { color: previewTheme.colors.primary }]}>PR</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 7, color: previewTheme.colors.textSecondary }}>Chest / Triceps</Text>
        <View style={[styles.previewProgressBg, { backgroundColor: previewTheme.colors.surfaceElevated }]}>
          <View style={[styles.previewProgressFill, { backgroundColor: previewTheme.colors.primary }]} />
        </View>
      </View>

      {/* Color Palette Chips */}
      <View style={styles.previewChipsRow}>
        {[
          previewTheme.colors.primary,
          previewTheme.colors.accent,
          previewTheme.colors.background,
          previewTheme.colors.surface,
          previewTheme.colors.border
        ].map((c, i) => (
          <View key={i} style={[styles.previewChip, { backgroundColor: c, borderColor: previewTheme.colors.border }]} />
        ))}
      </View>

      {/* Action Button */}
      <View style={[styles.previewBtn, { backgroundColor: previewTheme.colors.primary, borderRadius: previewTheme.shape.pill }]}>
        <Text style={[styles.previewBtnText, { color: previewTheme.colors.primaryForeground }]}>START WORKOUT</Text>
      </View>
    </View>
  );
};

export default function ThemesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme: activeTheme, themeMode, setThemeId, setThemeMode } = useTheme();

  const themesList = Object.keys(THEME_REGISTRY).map(
    (key) => THEME_REGISTRY[key as ThemeId][themeMode]
  );

  const numColumns = width > 600 ? 3 : 2;
  const cardWidth = (width - 32 - (numColumns - 1) * 12) / numColumns;

  return (
    <View style={[styles.screen, { backgroundColor: activeTheme.colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: activeTheme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={activeTheme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerTitle, { color: activeTheme.colors.textPrimary, fontWeight: activeTheme.typography.headingWeight }]}>Themes</Text>
          <Text style={[styles.headerSubtitle, { color: activeTheme.colors.textSecondary }]}>Same IronSync. Different vibe.</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Appearance Mode Selection Card */}
        <View style={[styles.appearanceCard, { backgroundColor: activeTheme.colors.surface, borderColor: activeTheme.colors.border, borderRadius: activeTheme.shape.radiusLg }]}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={[styles.appearanceTitle, { color: activeTheme.colors.textPrimary }]}>Appearance</Text>
            <Text style={[styles.appearanceSub, { color: activeTheme.colors.textSecondary }]}>Every theme ships a light and a dark variant.</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.appearanceToggle, { backgroundColor: activeTheme.colors.surfaceElevated, borderColor: activeTheme.colors.border }]}
            onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            activeOpacity={0.8}
          >
            {themeMode === 'light' ? (
              <View style={styles.toggleItem}>
                <Sun size={16} color={activeTheme.colors.primary} />
                <Text style={[styles.toggleText, { color: activeTheme.colors.textPrimary }]}>Light</Text>
              </View>
            ) : (
              <View style={styles.toggleItem}>
                <Moon size={16} color={activeTheme.colors.primary} />
                <Text style={[styles.toggleText, { color: activeTheme.colors.textPrimary }]}>Dark</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Gallery */}
        <View style={styles.galleryGrid}>
          {themesList.map((t) => {
            const isSelected = activeTheme.id === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.themeCard,
                  {
                    width: cardWidth,
                    backgroundColor: activeTheme.colors.surface,
                    borderColor: isSelected ? activeTheme.colors.primary : activeTheme.colors.border,
                    borderRadius: activeTheme.shape.radiusLg,
                    borderWidth: isSelected ? 2 : 1,
                  }
                ]}
                onPress={() => setThemeId(t.id)}
                activeOpacity={0.9}
              >
                {/* Theme Name Header */}
                <View style={styles.themeCardHeader}>
                  <Text 
                    style={[
                      styles.themeCardTitle, 
                      { 
                        color: activeTheme.colors.textPrimary,
                        fontWeight: activeTheme.typography.headingWeight 
                      }
                    ]}
                    numberOfLines={1}
                  >
                    {t.name}
                  </Text>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: activeTheme.colors.primary }]}>
                      <Check size={10} color={activeTheme.colors.primaryForeground} strokeWidth={3} />
                    </View>
                  )}
                </View>

                <Text style={[styles.themeCardDesc, { color: activeTheme.colors.textSecondary }]} numberOfLines={2}>
                  {t.description}
                </Text>

                {/* Reusable Theme Live Preview */}
                <ThemePreview previewTheme={t} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Footer */}
        <Text style={[styles.footerText, { color: activeTheme.colors.textSecondary }]}>
          Themes change visual identity only. Workouts, Duo, Community, Nutrition, Measurements and your data are untouched.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 60,
  },
  appearanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
  },
  appearanceTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  appearanceSub: {
    fontSize: 12,
    marginTop: 4,
  },
  appearanceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeCard: {
    padding: 12,
    justifyContent: 'space-between',
  },
  themeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  themeCardTitle: {
    fontSize: 14,
    flex: 1,
    marginRight: 4,
  },
  themeCardDesc: {
    fontSize: 10,
    lineHeight: 14,
    height: 28,
    marginBottom: 8,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  /* ThemePreview Styles */
  previewCard: {
    borderWidth: 1,
    padding: 8,
    gap: 6,
    marginTop: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 10,
    fontWeight: '700',
  },
  previewBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  previewBadgeText: {
    fontSize: 6,
    fontWeight: '800',
  },
  previewProgressBg: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  previewProgressFill: {
    width: '70%',
    height: '100%',
  },
  previewChipsRow: {
    flexDirection: 'row',
    gap: 3,
    marginVertical: 2,
  },
  previewChip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 0.5,
  },
  previewBtn: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBtnText: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
