import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

export default function ThemeWatermark() {
  const { theme } = useTheme();
  const watermark = theme.decorations.watermark;

  if (watermark === 'none') return null;

  const color = theme.colors.primary;

  const renderWatermarkSvg = () => {
    switch (watermark) {
      case 'signature':
        // Dumbbell watermark
        return (
          <Svg width={250} height={250} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={0.5} opacity={0.03}>
            <Path d="m6.5 6.5 11 11M21 21l-3.5-3.5M3 3l3.5 3.5M18.5 5.5l-11 11M21 3l-3.5 3.5M3 21l3.5-3.5" />
            <Circle cx={18} cy={6} r={3} />
            <Circle cx={6} cy={18} r={3} />
            <Circle cx={6} cy={6} r={3} />
            <Circle cx={18} cy={18} r={3} />
          </Svg>
        );
      case 'batman':
        // Bat silhouette (wings)
        return (
          <Svg width={300} height={200} viewBox="0 0 100 50" fill={color} opacity={0.02}>
            <Path d="M 50 15 C 43 5, 25 5, 10 20 C 5 25, 0 38, 12 40 C 25 42, 38 35, 42 30 C 45 27, 48 32, 50 35 C 52 32, 55 27, 58 30 C 62 35, 75 42, 88 40 C 100 38, 95 25, 90 20 C 75 5, 57 5, 50 15 Z" />
          </Svg>
        );
      case 'hello_kitty':
        // Kitty bow shape
        return (
          <Svg width={220} height={220} viewBox="0 0 100 100" fill={color} opacity={0.025}>
            {/* Ribbon Bow */}
            <Path d="M 50 50 C 40 30, 20 30, 25 50 C 30 70, 40 70, 50 55 C 60 70, 70 70, 75 50 C 80 30, 60 30, 50 50 Z" />
            <Circle cx={50} cy={51} r={8} fill={theme.colors.accent} />
          </Svg>
        );
      case 'cyber_purple':
        // Futuristic grid/lines
        return (
          <Svg width={300} height={300} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth={0.3} opacity={0.035}>
            <Circle cx={50} cy={50} r={40} />
            <Circle cx={50} cy={50} r={30} strokeDasharray="5,3" />
            <Circle cx={50} cy={50} r={20} />
            <Path d="M0 50 H100 M50 0 V100 M15 15 L85 85 M15 85 L85 15" strokeDasharray="2,2" />
          </Svg>
        );
      case 'iron_man':
        // Concentric HUD arc reactor
        return (
          <Svg width={280} height={280} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth={0.5} opacity={0.03}>
            <Circle cx={50} cy={50} r={45} strokeDasharray="3,1.5" />
            <Circle cx={50} cy={50} r={35} />
            <Circle cx={50} cy={50} r={25} strokeDasharray="8,4" strokeWidth={1} />
            <Circle cx={50} cy={50} r={15} />
            <Circle cx={50} cy={50} r={5} fill={color} />
            {/* HUD ticks */}
            <Path d="M50 2 V8 M50 92 V98 M2 50 H8 M92 50 H98" />
          </Svg>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container} pointerEvents="none">
      {renderWatermarkSvg()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: height * 0.25,
    left: (width - 300) / 2,
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
});
