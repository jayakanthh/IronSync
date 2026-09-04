import React, { useRef } from 'react';
import { Animated, PanResponder, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { colors, radius } from '../../theme/colors';

/** How far the row slides open, and how far you must drag to open it. */
const ACTION_WIDTH = 84;
const OPEN_THRESHOLD = ACTION_WIDTH * 0.45;

/**
 * Swipe a row left to reveal a Delete button. Tapping Delete is the
 * confirmation, so there's no dialog on top of the gesture.
 *
 * Built on PanResponder rather than a gesture library: the app is pinned to
 * Expo Go / SDK 54, and this is one interaction — not worth two native deps.
 * The responder only claims clearly-horizontal drags, so vertical scrolling
 * and taps on inputs inside the row still work.
 */
export default function SwipeToDelete({
  children,
  onDelete,
  style,
  label = 'Delete',
  background = colors.surface,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
  label?: string;
  /** The sliding layer must be opaque or the delete panel shows through it. */
  background?: string;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);

  const slideTo = (to: number) => {
    openRef.current = to !== 0;
    Animated.spring(translateX, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      // Never claim the initial touch, so taps reach the inputs and buttons.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const base = openRef.current ? -ACTION_WIDTH : 0;
        const next = Math.min(0, Math.max(-ACTION_WIDTH, base + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const base = openRef.current ? -ACTION_WIDTH : 0;
        const settled = base + g.dx;
        slideTo(settled < -OPEN_THRESHOLD ? -ACTION_WIDTH : 0);
      },
      onPanResponderTerminate: () => slideTo(openRef.current ? -ACTION_WIDTH : 0),
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      {/* Sits behind the row and is uncovered as it slides. */}
      <View style={styles.actionLayer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => {
            slideTo(0);
            onDelete();
          }}
        >
          <Trash2 size={16} color="#fff" />
          <Text style={styles.deleteText}>{label}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[{ backgroundColor: background }, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {/* The caller's row style goes inside, so a translucent state tint
            (e.g. "completed") layers over the opaque base above. */}
        <View style={style}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  actionLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: ACTION_WIDTH,
    height: '100%',
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  deleteText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
