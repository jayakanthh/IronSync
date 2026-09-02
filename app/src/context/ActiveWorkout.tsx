import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * Tracks whether a workout is running, so the rest of the app can react to it:
 * the mini "Workout in progress" bar, and hiding "Start New Workout" while one
 * is already going.
 *
 * The session's actual data (exercises, sets, timer) stays in LogWorkoutScreen.
 * Minimising just switches tabs, which leaves that screen mounted on the
 * Workouts stack with its state intact — so this only needs to know that a
 * workout exists, what it's called, and how to discard it from outside.
 */
interface ActiveWorkoutValue {
  /** Null when nothing is running. */
  active: { label: string; startedAt: number } | null;
  /** True when the logger is running but the user has stepped away from it. */
  minimized: boolean;
  begin: (label: string) => void;
  end: () => void;
  minimize: () => void;
  restore: () => void;
  /** The logger hands over its own discard routine while it's mounted. */
  registerDiscard: (fn: (() => void) | null) => void;
  discard: () => void;
}

const ActiveWorkoutContext = createContext<ActiveWorkoutValue | null>(null);

export function ActiveWorkoutProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveWorkoutValue['active']>(null);
  const [minimized, setMinimized] = useState(false);
  const discardRef = useRef<(() => void) | null>(null);

  const begin = useCallback((label: string) => {
    setActive({ label, startedAt: Date.now() });
    setMinimized(false);
  }, []);

  const end = useCallback(() => {
    setActive(null);
    setMinimized(false);
  }, []);

  /**
   * Hands off to the logger, which confirms first. Deliberately doesn't clear
   * `minimized` — if the user cancels the confirmation the workout is still
   * running, and the bar has to stay up or there's no way back to it.
   * Discarding for real unmounts the logger, and `end()` clears both flags.
   */
  const discard = useCallback(() => {
    discardRef.current?.();
  }, []);

  const value = useMemo<ActiveWorkoutValue>(
    () => ({
      active,
      minimized,
      begin,
      end,
      minimize: () => setMinimized(true),
      restore: () => setMinimized(false),
      registerDiscard: (fn) => { discardRef.current = fn; },
      discard,
    }),
    [active, minimized, begin, end, discard],
  );

  return <ActiveWorkoutContext.Provider value={value}>{children}</ActiveWorkoutContext.Provider>;
}

/** Safe outside the provider (returns an inert value) so screens can't crash. */
export function useActiveWorkout(): ActiveWorkoutValue {
  return (
    useContext(ActiveWorkoutContext) ?? {
      active: null,
      minimized: false,
      begin: () => {},
      end: () => {},
      minimize: () => {},
      restore: () => {},
      registerDiscard: () => {},
      discard: () => {},
    }
  );
}
