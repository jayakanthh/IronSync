import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../../theme/colors';

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outline' | 'surfaceAlt';
}

export const Card: React.FC<CardProps> = ({ variant = 'default', style, children, ...rest }) => {
  const { theme } = useTheme();

  const cardStyle = {
    backgroundColor: variant === 'surfaceAlt' ? theme.colors.surfaceElevated : theme.colors.surface,
    borderRadius: theme.shape.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: variant === 'outline' ? theme.colors.primary : theme.colors.border,
    ...(variant === 'elevated' ? theme.shape.shadows : {}),
  };

  return (
    <View style={[cardStyle, style]} {...rest}>
      {children}
    </View>
  );
};

export default Card;
