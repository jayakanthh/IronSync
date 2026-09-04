import React, { createContext, useContext, useMemo, useRef } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play } from 'lucide-react-native';
import { useTheme } from '../../theme/colors';
import { useActiveWorkout } from '../../context/ActiveWorkout';

/**
 * Floating "Start New Workout" pill, shown on Home & Workouts. Tapping it starts
 * straight away — the caller wires onPress to startWorkout() (default plan, or a
 * free workout if none). Rendered absolutely so it floats above the tab bar.
 *
 * It hides itself while you scroll down and comes back when you scroll up, so it
 * never sits on top of the list you're reading. Wire it up like this:
 *
 *   <StartWorkoutScrollProvider>       // in the screen that renders the button
 *     <SomeList />                     // the list calls useStartWorkoutScroll()
 *     <StartWorkoutButton onPress={…} />
 *   </StartWorkoutScrollProvider>
 *
 *   const scrollProps = useStartWorkoutScroll();
 *   <ScrollView {...scrollProps}>…</ScrollView>
 */

/** How far the pill travels down (past the tab bar) when it hides. */
const HIDE_DISTANCE = 140;
/** Ignore scroll jitter below this many points. */
const SCROLL_THRESHOLD = 6;
/** Always show the pill while we're near the top of the list. */
const ALWAYS_SHOW_ABOVE = 40;

type ScrollProps = {
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
};

const NOOP_SCROLL_PROPS: ScrollProps = { onScroll: () => {}, scrollEventThrottle: 16 };

const StartWorkoutScrollContext = createContext<{
  hidden: Animated.Value;
  scrollProps: ScrollProps;
} | null>(null);

/**
 * Shares one "is the pill hidden" value between the scrolling list and the pill,
 * so neither has to know about the other. Outside a provider the pill just stays put.
 */
export function StartWorkoutScrollProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => {
    const hidden = new Animated.Value(0);
    return { hidden, ...makeScrollHandler(hidden) };
  }, []);
  return (
    <StartWorkoutScrollContext.Provider value={value}>{children}</StartWorkoutScrollContext.Provider>
  );
}

function makeScrollHandler(hidden: Animated.Value) {
  let lastY = 0;
  let isHidden = false;
  const setHidden = (next: boolean) => {
    if (next === isHidden) return;
    isHidden = next;
    Animated.timing(hidden, {
      toValue: next ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY;
    if (y <= ALWAYS_SHOW_ABOVE) {
      setHidden(false);
    } else if (dy > SCROLL_THRESHOLD) {
      setHidden(true); // scrolling down — get out of the way
    } else if (dy < -SCROLL_THRESHOLD) {
      setHidden(false); // scrolling back up — come back
    }
    if (Math.abs(dy) > SCROLL_THRESHOLD) lastY = y;
  };
  return { scrollProps: { onScroll, scrollEventThrottle: 16 } as ScrollProps };
}

/** Spread the result onto the screen's ScrollView/FlatList to drive the pill. */
export function useStartWorkoutScroll(): ScrollProps {
  return useContext(StartWorkoutScrollContext)?.scrollProps ?? NOOP_SCROLL_PROPS;
}

export default function StartWorkoutButton({ onPress }: { onPress: () => void }) {
  const { themeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const hidden = useContext(StartWorkoutScrollContext)?.hidden;
  const { active } = useActiveWorkout();
  // Sit just above the (absolute, overlaid) tab bar: its ~49pt bar + bottom inset.
  const bottom = insets.bottom + 58;

  const animatedStyle = hidden
    ? {
        opacity: hidden.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [
          { translateY: hidden.interpolate({ inputRange: [0, 1], outputRange: [0, HIDE_DISTANCE] }) },
        ],
      }
    : null;

  // One workout at a time: while one is running the mini bar owns this space.
  if (active) return null;

  return (
    <Animated.View style={[styles.wrap, { bottom }, animatedStyle]} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.pill, themeMode === 'light' && styles.pillLight]}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <Play size={17} color="#000000" fill="#000000" />
        <Text style={styles.text}>Start New Workout</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Right-aligned so it never covers the left edge of the cards behind it.
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'flex-end', paddingRight: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  // On a light background a plain white pill would disappear — outline it.
  pillLight: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  text: { color: '#000000', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
