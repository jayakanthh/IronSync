import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../theme/colors';
import { Typography } from './Typography';

interface ButtonProps extends TouchableOpacityProps {
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  style,
  disabled,
  children,
  ...rest
}) => {
  const { theme } = useTheme();

  const getBackgroundColor = () => {
    if (disabled && variant !== 'ghost' && variant !== 'outline') return theme.colors.border;
    switch (variant) {
      case 'primary': return theme.colors.primary;
      case 'secondary': return theme.colors.surfaceElevated;
      case 'danger': return theme.colors.danger;
      case 'ghost': return 'transparent';
      case 'outline': return 'transparent';
      default: return theme.colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.textMuted;
    switch (variant) {
      case 'primary': return theme.colors.primaryForeground;
      case 'secondary': return theme.colors.textPrimary;
      case 'danger': return '#FFF';
      case 'outline': return theme.colors.primary;
      case 'ghost': return theme.colors.textPrimary;
      default: return theme.colors.primaryForeground;
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') return theme.colors.primary;
    if (variant === 'secondary') return theme.colors.border;
    return 'transparent';
  };

  const getHeight = () => {
    switch (size) {
      case 'sm': return 36;
      case 'lg': return 56;
      case 'md':
      default: return 48;
    }
  };

  const labelTextStyle = {
    textTransform: (variant === 'primary' ? 'uppercase' : 'none') as 'uppercase' | 'none',
    letterSpacing: variant === 'primary' ? 1 : 0,
  };

  return (
    <TouchableOpacity
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0,
          height: getHeight(),
          borderRadius: theme.shape.pill,
        },
        style,
      ]}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          {label != null && label !== '' ? (
            <Typography variant="bodyBold" color={getTextColor()} style={labelTextStyle}>
              {label}
            </Typography>
          ) : (
            // Wrap EACH string/number child in <Text> (children may be a mixed
            // array like ['Code: ', code]); real nodes (icons) pass through.
            React.Children.map(children, (child) =>
              typeof child === 'string' || typeof child === 'number' ? (
                <Typography variant="bodyBold" color={getTextColor()} style={labelTextStyle}>
                  {child}
                </Typography>
              ) : (
                child
              ),
            )
          )}
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
});

export default Button;
