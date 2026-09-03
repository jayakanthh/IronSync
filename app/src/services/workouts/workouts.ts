/**
 * Workouts service — log a workout, read history, and the side effects that
 * a workout triggers: personal-record detection and the streak update.
 * Owner: jaikanth (backend).
 *
 * SCOPE NOTE (client vs server):
 *  - Updating YOUR OWN streak and YOUR OWN PR docs happens here, client-side.
 *    That's fine — it's your own data and the security rules already allow it.
 *  - Updating GROUP leaderboards and sending "someone beat your PR" push
 *    notifications will live in a Cloud Function (Phase 2), because that touches
 *    other people's data and must be trusted/server-side. See backend/functions/.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  estimate1RM,
  type LeaderboardEntry,
  type PersonalRecord,
  type Workout,
} from '../../models/index';
import { todayISO } from '../../utils/formatting/dates';
import { db } from '../../config/firebase';
import { syncPersonalRecordToGroups, syncStreakToGroups } from '../duo/groups';
import { streakOnWorkout, type StreakState } from './streaks';
import { getUser } from '../users/users';

/** A crew-mate this workout knocked off the #1 spot — for a notification later. */
export interface Dethroned {
  groupId: string;
  exerciseId: string;
  dethronedUserId: string;
}

/** What logging a workout produced — handy for the UI to celebrate. */
export interface LogWorkoutResult {
  workoutId: string;
  newPRs: PersonalRecord[]; // exercises where this session set a new PR
  streak: StreakState;
  dethroned: Dethroned[]; // crew PRs this session took over
}

/**
 * Log a workout, then update PRs and the streak.
 * `date` defaults to today; pass it to back-fill a past session.
 */
export async function logWorkout(
  userId: string,
  workout: Omit<Workout, 'id' | 'createdAt'>,
): Promise<LogWorkoutResult> {
  const date = workout.date || todayISO();

  // Idempotency: Prevent duplicate logs for the same session
  if (workout.sessionId) {
    const existingQ = query(
      collection(db, 'users', userId, 'workouts'),
      where('sessionId', '==', workout.sessionId),
      limit(1)
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      const user = await getUser(userId);
      return {
        workoutId: existingDoc.id,
        newPRs: [],
        dethroned: [],
        streak: {
          currentStreak: user?.currentStreak ?? 0,
          longestStreak: user?.longestStreak ?? 0,
          lastTrainedDate: user?.lastTrainedDate,
        },
      };
    }
  }

  // 1. Save the workout.
  const ref = await addDoc(collection(db, 'users', userId, 'workouts'), {
    // Default to friends-visible: the point of the crew is seeing each other
    // train. Settings > stats sharing is the master switch, enforced in
    // firestore.rules, and a workout can still be logged as 'only_me'.
    visibility: workout.visibility ?? 'friends',
    ...workout,
    date,
    createdAt: Date.now(),
  });

  // 2. Detect & save new PRs.
  const newPRs = await updatePRsFromWorkout(userId, ref.id, date, workout.entries);

  // 3. Update the streak.
  const user = await getUser(userId);
  const prevState: StreakState = {
    currentStreak: user?.currentStreak ?? 0,
    longestStreak: user?.longestStreak ?? 0,
    lastTrainedDate: user?.lastTrainedDate,
  };
  const streak = streakOnWorkout(prevState, user?.trainingDays ?? [], date);
  if (streak !== prevState) {
    await updateDoc(doc(db, 'users', userId), {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastTrainedDate: streak.lastTrainedDate,
    });
  }

  // 4. Push updates to the crew boards (client-side on Spark; a Cloud Function
  //    will own this once we're on Blaze — see backend/functions/).
  const groupIds = user?.groupIds ?? [];
  const displayName = user?.displayName ?? 'Someone';
  const dethroned: Dethroned[] = [];
  if (groupIds.length > 0) {
    await syncStreakToGroups(groupIds, {
      userId,
      displayName,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
    });
    for (const pr of newPRs) {
      const entry: LeaderboardEntry = {
        userId,
        displayName,
        estimated1RM: pr.estimated1RM,
        weightKg: pr.bestWeightKg,
        reps: pr.bestReps,
        date: pr.achievedOn,
      };
      const results = await syncPersonalRecordToGroups(groupIds, entry, pr.exerciseId);
      for (const r of results) {
        if (r.dethronedUserId) {
          dethroned.push({
            groupId: r.groupId,
            exerciseId: pr.exerciseId,
            dethronedUserId: r.dethronedUserId,
          });
        }
      }
    }
  }

  return { workoutId: ref.id, newPRs, streak, dethroned };
}

/** For each exercise in the workout, save a PR if this session beat the stored one. */
async function updatePRsFromWorkout(
  userId: string,
  workoutId: string,
  date: string,
  entries: Workout['entries'],
): Promise<PersonalRecord[]> {
  // Best estimated-1RM set per exercise in this workout.
  const bestByExercise = new Map<string, { e1rm: number; weightKg: number; reps: number }>();
  for (const entry of entries) {
    for (const set of entry.sets) {
      const e1rm = estimate1RM(set.weightKg, set.reps);
      const cur = bestByExercise.get(entry.exerciseId);
      if (!cur || e1rm > cur.e1rm) {
        bestByExercise.set(entry.exerciseId, { e1rm, weightKg: set.weightKg, reps: set.reps });
      }
    }
  }

  const beaten: PersonalRecord[] = [];
  for (const [exerciseId, best] of bestByExercise) {
    const prRef = doc(db, 'users', userId, 'prs', exerciseId);
    const existing = await getDoc(prRef);
    const prevBest = existing.exists() ? (existing.data() as PersonalRecord).estimated1RM : 0;
    if (best.e1rm > prevBest) {
      const pr: PersonalRecord = {
        exerciseId,
        estimated1RM: best.e1rm,
        bestWeightKg: best.weightKg,
        bestReps: best.reps,
        achievedOn: date,
        workoutId,
      };
      await setDoc(prRef, pr);
      beaten.push(pr);
    }
  }
  return beaten;
}

/** Recent workouts, newest first. */
export async function getWorkoutHistory(userId: string, max = 30): Promise<Workout[]> {
  const q = query(
    collection(db, 'users', userId, 'workouts'),
    orderBy('date', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
}

/**
 * A friend's shared workouts. The `visibility` filter isn't cosmetic — the
 * security rule only permits reading docs shared with friends, so a query
 * without it is rejected outright rather than returning less.
 *
 * Returns [] if you're not their friend or they've turned stats sharing off.
 */
export async function getFriendWorkouts(friendId: string, max = 10): Promise<Workout[]> {
  try {
    const q = query(
      collection(db, 'users', friendId, 'workouts'),
      where('visibility', 'in', ['friends', 'everyone']),
      orderBy('date', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
  } catch (err: any) {
    // Not a friend, or they don't share — both are legitimately empty. Anything
    // else is a bug, and silence made those two look the same.
    if (err?.code !== 'permission-denied') {
      console.warn('[getFriendWorkouts] failed:', err?.message ?? err);
    }
    return [];
  }
}

/** Get a specific workout by ID */
export async function getWorkoutById(userId: string, workoutId: string): Promise<Workout | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'workouts', workoutId));
  if (!snap.exists()) return null;
  return snap.data() as Workout;
}

/** All of a user's current PRs. */
export async function getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  const snap = await getDocs(collection(db, 'users', userId, 'prs'));
  return snap.docs.map((d) => d.data() as PersonalRecord);
}

/** Retrieve the user's previous performance sets for a given exercise */
export async function getPreviousPerformance(userId: string, exerciseId: string): Promise<string[]> {
  const workouts = await getWorkoutHistory(userId, 10);
  for (const w of workouts) {
    const entry = w.entries.find((e) => e.exerciseId === exerciseId);
    if (entry && entry.sets && entry.sets.length > 0) {
      return entry.sets.map((s) => `${s.weightKg} kg × ${s.reps}`);
    }
  }
  return [];
}

/** Fetch user workouts within a date range (startMs to endMs). */
export async function getUserWorkoutsInRange(
  userId: string,
  startMs: number,
  endMs: number
): Promise<Workout[]> {
  try {
    const q = query(
      collection(db, 'users', userId, 'workouts'),
      where('createdAt', '>=', startMs),
      where('createdAt', '<=', endMs),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
  } catch (err) {
    // Resilient in-memory fallback
    const fallbackQ = query(
      collection(db, 'users', userId, 'workouts'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snap = await getDocs(fallbackQ);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }))
      .filter((w) => (w.createdAt || 0) >= startMs && (w.createdAt || 0) <= endMs);
  }
}
