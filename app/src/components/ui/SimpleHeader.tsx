import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../theme/colors';

export function SimpleHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const containerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    zIndex: 40,
    paddingTop: insets.top + 8,
  };

  return (
    <View style={containerStyle}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <ChevronLeft size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: theme.colors.textPrimary, fontWeight: theme.typography.headingWeight }]}>{title}</Text>
      <View style={styles.rightSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
  },
  rightSpacer: {
    width: 32,
  },
});
