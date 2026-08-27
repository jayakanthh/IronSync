import React from 'react';
import { Text, TouchableOpacity, TouchableOpacityProps, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/colors';

interface PillProps extends TouchableOpacityProps {
  label: string;
  active?: boolean;
}

/** Filter chip / category pill — used in Workouts, Exercise Library, Home category row. */
export default function Pill({ label, active, style, ...props }: PillProps) {
  const { theme } = useTheme();

  const pillStyle = {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.shape.pill,
    backgroundColor: active ? theme.colors.primary : theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: active ? theme.colors.primary : theme.colors.border,
    marginRight: 4,
  };

  const textStyle = {
    color: active ? theme.colors.primaryForeground : theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  };

  return (
    <TouchableOpacity style={[pillStyle, style]} activeOpacity={0.85} {...props}>
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}
