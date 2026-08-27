import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../../theme/colors';

interface TypographyProps extends TextProps {
  variant?: 'h1' | 'h2' | 'body' | 'bodyBold' | 'caption' | 'label' | 'subtitle' | 'captionSmall';
  color?: string;
  weight?: 'normal' | '500' | '600' | '700' | '800' | '900';
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  color,
  weight,
  align = 'left',
  style,
  children,
  ...rest
}) => {
  const { theme } = useTheme();

  // Resolve base style from active theme typography
  let baseStyle: any = {};
  const headingWeight = theme.typography.headingWeight;
  const letterSpacing = theme.typography.letterSpacing;

  switch (variant) {
    case 'h1':
      baseStyle = { fontSize: 22, fontWeight: headingWeight };
      break;
    case 'h2':
      baseStyle = { fontSize: 18, fontWeight: headingWeight };
      break;
    case 'bodyBold':
      baseStyle = { fontSize: 14, fontWeight: '700' };
      break;
    case 'caption':
      baseStyle = { fontSize: 12, fontWeight: '600' };
      break;
    case 'label':
      baseStyle = { fontSize: 11, fontWeight: '700', letterSpacing: letterSpacing || 1 };
      break;
    case 'subtitle':
      baseStyle = { fontSize: 16, fontWeight: '600' };
      break;
    case 'captionSmall':
      baseStyle = { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' as const };
      break;
    case 'body':
    default:
      baseStyle = { fontSize: 14, fontWeight: '400' };
      break;
  }

  const textColor = color || theme.colors.textPrimary;

  return (
    <Text
      style={[
        baseStyle,
        { color: textColor, textAlign: align },
        weight ? { fontWeight: weight } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
};

export default Typography;
