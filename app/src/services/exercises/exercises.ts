/**
 * Exercises service — the shared exercise library.
 * Owner: jaikanth (backend).
 *
 * The library is seeded (from ExerciseDB / free-exercise-db) into the top-level
 * `exercises` collection — see backend/ for the seed script. Everyone reads it;
 * users can also add their own custom exercises.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  limit,
  startAfter,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { Exercise } from '../../models/index';
import { db } from '../../config/firebase';

/** 
 * Get a chunk of exercises (paginated or limited).
 * If lastDoc is provided, it fetches the next page.
 */
export async function getExercises(max = 50, lastDoc?: QueryDocumentSnapshot): Promise<{ data: Exercise[], lastDoc?: QueryDocumentSnapshot }> {
  let q = query(collection(db, 'exercises'), orderBy('name'), limit(max));
  if (lastDoc) {
    q = query(collection(db, 'exercises'), orderBy('name'), startAfter(lastDoc), limit(max));
  }
  const snap = await getDocs(q);
  const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, 'id'>) }));
  return { data, lastDoc: snap.docs[snap.docs.length - 1] };
}

/** 
 * Search exercises by prefix name.
 * Note: Firestore string searching is limited to exact or prefix matches unless using a 3rd party index.
 */
export async function searchExercises(nameQuery: string, max = 50): Promise<Exercise[]> {
  const clean = nameQuery.trim().toLowerCase();
  // Using prefix search (requires name to be indexed or simple query)
  // But wait, the name in db isn't lowercased. For simple searching, we might just query limit(50) 
  // and do local filter, but 11k makes that hard.
  // Actually, we can fetch all by muscleGroup if specified, or use prefix search.
  // We'll simulate a simple query for now.
  const q = query(
    collection(db, 'exercises'),
    where('name', '>=', nameQuery),
    where('name', '<=', nameQuery + '\uf8ff'),
    orderBy('name'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, 'id'>) }));
}

/** Exercises for a given muscle group. */
export async function getExercisesByMuscle(muscleGroup: string, max = 50): Promise<Exercise[]> {
  const q = query(
    collection(db, 'exercises'),
    where('muscleGroup', '==', muscleGroup.toLowerCase()),
    limit(max)
  );
  const snap = await getDocs(q);
  const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, 'id'>) }));
  return data.sort((a, b) => a.name.localeCompare(b.name));
}

/** One exercise by id, with legacy ID bridge support. */
export async function getExercise(exerciseId: string): Promise<Exercise | null> {
  // 1. Direct document ID lookup
  const snap = await getDoc(doc(db, 'exercises', exerciseId));
  if (snap.exists()) {
    return { id: snap.id, ...(snap.data() as Omit<Exercise, 'id'>) };
  }
  // 2. Fallback to legacyIds lookup
  const q = query(
    collection(db, 'exercises'),
    where('legacyIds', 'array-contains', exerciseId),
    limit(1)
  );
  const legacySnap = await getDocs(q);
  if (!legacySnap.empty) {
    const d = legacySnap.docs[0];
    return { id: d.id, ...(d.data() as Omit<Exercise, 'id'>) };
  }
  return null;
}

/** Fetch multiple exercises efficiently, batching lookups. */
export async function getExercisesByIds(ids: string[]): Promise<Exercise[]> {
  if (!ids || ids.length === 0) return [];
  const uniqueIds = Array.from(new Set(ids));
  const promises = uniqueIds.map(async (id) => {
    try {
      return await getExercise(id);
    } catch (err) {
      console.error(`Error loading exercise ${id}:`, err);
      return null;
    }
  });
  const results = await Promise.all(promises);
  return results.filter((ex): ex is Exercise => ex !== null);
}

/** Add a user's custom exercise to the library. */
export async function addCustomExercise(
  userId: string,
  data: {
    name: string;
    muscleGroup: string;
    equipment?: string;
    secondaryMuscles?: string[];
    trackingType?: string;
    category?: string;
  },
): Promise<string> {
  const ref = doc(collection(db, 'exercises'));
  const exercise: Exercise & { trackingType?: string } = {
    id: ref.id,
    name: data.name,
    muscleGroup: data.muscleGroup,
    equipment: data.equipment ?? null,
    secondaryMuscles: data.secondaryMuscles ?? [],
    isCustom: true,
    createdBy: userId,
    category: data.category ?? 'custom',
    ...(data.trackingType ? { trackingType: data.trackingType } : {}),
  };
  await setDoc(ref, exercise);
  return ref.id;
}

export interface RecentExerciseRow {
  exerciseId: string;
  exerciseName: string;
  lastPerformedAt: number;
  lastSummary?: string;
}

/**
 * Recent exercises performed by a user, one row per distinct exercise,
 * most-recently-performed first - used by RecentExercisesCard.
 *
 * NOTE: built from the same `users/{userId}/workouts` subcollection as
 * getUserRecentExercises below. Once you send over workouts.ts, I'll
 * double check the `entries`/`sets` field names match your real workout
 * documents - right now this assumes:
 *   workout.entries: { exerciseId: string; sets?: { weight?, reps? }[] }[]
 * which mirrors what OverviewTab.tsx already reads off workout documents.
 */
export async function getRecentExercisesForUser(userId: string, max = 8): Promise<RecentExerciseRow[]> {
  const q = query(
    collection(db, 'users', userId, 'workouts'),
    orderBy('createdAt', 'desc'),
    limit(30) // scan enough recent workouts to surface `max` distinct exercises
  );
  const snap = await getDocs(q);

  interface RawHit {
    exerciseId: string;
    lastPerformedAt: number;
    setCount: number;
    topWeight?: number;
    topReps?: number;
  }
  const seen = new Map<string, RawHit>();

  for (const d of snap.docs) {
    const workout = d.data() as any;
    const createdAt: number = workout.createdAt ?? 0;
    const entries: { exerciseId: string; sets?: { weight?: number; weightKg?: number; reps?: number }[] }[] = workout.entries ?? [];

    for (const entry of entries) {
      if (seen.has(entry.exerciseId)) continue; // keep only the most recent occurrence

      const sets = Array.isArray(entry.sets) ? entry.sets : [];
      let topWeight: number | undefined;
      let topReps: number | undefined;
      for (const s of sets) {
        const w = s.weightKg ?? s.weight;
        if (typeof w === 'number' && (topWeight === undefined || w > topWeight)) {
          topWeight = w;
          topReps = s.reps;
        }
      }

      seen.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        lastPerformedAt: createdAt,
        setCount: sets.length,
        topWeight,
        topReps,
      });

      if (seen.size >= max) break;
    }
    if (seen.size >= max) break;
  }

  const hits = Array.from(seen.values());
  const exercises = await getExercisesByIds(hits.map(h => h.exerciseId));
  const exerciseNameById = new Map(exercises.map(e => [e.id, e.name]));

  return hits
    .sort((a, b) => b.lastPerformedAt - a.lastPerformedAt)
    .map(h => ({
      exerciseId: h.exerciseId,
      exerciseName: exerciseNameById.get(h.exerciseId) ?? 'Unknown exercise',
      lastPerformedAt: h.lastPerformedAt,
      lastSummary:
        h.setCount > 0
          ? `${h.setCount} ${h.setCount === 1 ? 'set' : 'sets'}${typeof h.topWeight === 'number' ? `  ·  top ${h.topWeight}kg x ${h.topReps ?? '?'}` : ''}`
          : undefined,
    }));
}

export interface UserExerciseSessionHistory {
  date: number;
  sets: number;
  volume: number;
  topSet?: { weight: number; reps: number };
}

/** Get full session history for a user on a specific exercise. */
export async function getExerciseHistoryForUser(
  userId: string,
  exerciseId: string,
  max = 50
): Promise<UserExerciseSessionHistory[]> {
  const q = query(
    collection(db, 'users', userId, 'workouts'),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  const results: UserExerciseSessionHistory[] = [];

  for (const d of snap.docs) {
    const workout = d.data() as any;
    const createdAt: number = workout.createdAt ?? (workout.date ? new Date(workout.date).getTime() : 0);
    const entries: { exerciseId: string; sets?: { weight?: number; weightKg?: number; reps?: number }[] }[] = workout.entries ?? [];

    const matchingEntry = entries.find((e) => e.exerciseId === exerciseId);
    if (matchingEntry) {
      const sets = Array.isArray(matchingEntry.sets) ? matchingEntry.sets : [];
      let totalVolume = 0;
      let topWeight = 0;
      let topReps = 0;

      for (const s of sets) {
        const w = s.weightKg ?? s.weight ?? 0;
        const r = s.reps ?? 0;
        totalVolume += w * r;
        if (w > topWeight || (w === topWeight && r > topReps)) {
          topWeight = w;
          topReps = r;
        }
      }

      if (sets.length > 0) {
        results.push({
          date: createdAt,
          sets: sets.length,
          volume: totalVolume,
          topSet: topWeight > 0 ? { weight: topWeight, reps: topReps } : undefined,
        });
      }
    }
  }

  return results;
}

/** Get recent exercises performed by a user (last N workout entries). */
export async function getUserRecentExercises(userId: string, max = 20): Promise<string[]> {
  const q = query(
    collection(db, 'users', userId, 'workouts'),
    orderBy('createdAt', 'desc'),
    limit(5)
  );
  const snap = await getDocs(q);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const d of snap.docs) {
    const entries: { exerciseId: string }[] = (d.data() as any).entries ?? [];
    for (const e of entries) {
      if (!seen.has(e.exerciseId)) { seen.add(e.exerciseId); ids.push(e.exerciseId); }
    }
    if (ids.length >= max) break;
  }
  return ids.slice(0, max);
}