/**
 * Users service — profile create / read / update.
 * Owner: jaikanth (backend).
 */
import { arrayRemove, arrayUnion, doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';
import type { PublicProfile, User, Weekday } from '../../models/index';
import { auth, db } from '../../config/firebase';

const userRef = (userId: string) => doc(db, 'users', userId);

/** Create a new profile with sensible defaults. Called on sign-up. */
export async function createUserProfile(
  userId: string,
  data: { displayName: string; email: string },
): Promise<void> {
  const profile: User = {
    id: userId,
    displayName: data.displayName,
    email: data.email,
    createdAt: Date.now(),
    trainingDays: [], // user picks these during onboarding
    currentStreak: 0,
    longestStreak: 0,
    groupIds: [],
  };
  await setDoc(userRef(userId), profile);
}

/** Read a user's profile, or null if it doesn't exist. */
export async function getUser(userId: string): Promise<User | null> {
  const snap = await getDoc(userRef(userId));
  return snap.exists() ? (snap.data() as User) : null;
}

/** Patch profile fields (name, age, goal, height, etc.). */
export async function updateUser(
  userId: string,
  patch: Partial<Omit<User, 'id'>>,
): Promise<void> {
  await updateDoc(userRef(userId), patch);
}

/** Set which weekdays are training days (drives the streak). */
export async function setTrainingDays(userId: string, days: Weekday[]): Promise<void> {
  await updateDoc(userRef(userId), { trainingDays: days });
}

/** Set the plan the user is currently following (drives Home's "Today's Plan"). */
export async function setActivePlan(userId: string, planId: string | null): Promise<void> {
  await updateDoc(userRef(userId), { activePlanId: planId });
}

/** Bookmark/unbookmark a public plan (Workouts > Saved tab). Own doc only — always allowed. */
export async function toggleSavedPlan(userId: string, planId: string, save: boolean): Promise<void> {
  await updateDoc(userRef(userId), {
    savedPlanIds: save ? arrayUnion(planId) : arrayRemove(planId),
  });
}

/** Stats collected during first-run onboarding. */
export interface OnboardingData {
  age?: number;
  heightCm?: number;
  weightKg?: number;
  goal?: User['goal'];
  trainingDays: Weekday[];
}

/**
 * Save onboarding answers and mark the profile onboarded. Writes a COMPLETE
 * profile (identity from Auth + streak/group defaults) via setDoc+merge, so it
 * works whether or not a profile doc already exists — anyone reaching onboarding
 * is new, so the zeroed streak/empty groups are correct.
 */
export async function completeOnboarding(
  userId: string,
  data: OnboardingData,
): Promise<void> {
  const fb = auth.currentUser;
  const profile: User = {
    id: userId,
    displayName: fb?.displayName || fb?.email?.split('@')[0] || 'Lifter',
    email: fb?.email ?? '',
    createdAt: Date.now(),
    age: data.age,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    goal: data.goal,
    trainingDays: data.trainingDays,
    currentStreak: 0,
    longestStreak: 0,
    groupIds: [],
    onboarded: true,
  };
  await setDoc(userRef(userId), profile, { merge: true });
}

/** Normalize a username (strip leading @, trim, lowercase) */
export function normalizeUsername(username: string): string {
  let clean = username.trim().toLowerCase();
  if (clean.startsWith('@')) {
    clean = clean.slice(1);
  }
  return clean;
}

/** Validate username format: alphanumeric + underscores, 3-15 chars */
export function validateUsernameFormat(username: string): boolean {
  const normalized = normalizeUsername(username);
  return /^[a-z0-9_]{3,15}$/.test(normalized);
}

/** Check if a username is available globally */
export async function isUsernameAvailable(username: string, currentUid?: string): Promise<boolean> {
  const normalized = normalizeUsername(username);
  if (!validateUsernameFormat(normalized)) return false;
  const docRef = doc(db, 'usernames', normalized);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return true;
  if (currentUid && snap.data()?.uid === currentUid) return true;
  return false;
}

/** Save/Update user's username. Updates unique lookup in 'usernames' collection and 'users' collection. */
export async function saveUsername(userId: string, username: string): Promise<void> {
  const normalized = normalizeUsername(username);
  const available = await isUsernameAvailable(normalized, userId);
  if (!available) {
    throw new Error('Username is already taken or invalid.');
  }

  // Get current user profile to see if there is an old username to delete
  const user = await getUser(userId);
  if (user && user.username) {
    const oldNormalized = normalizeUsername(user.username);
    if (oldNormalized !== normalized) {
      await deleteDoc(doc(db, 'usernames', oldNormalized));
    }
  }

  // Write new lookup
  await setDoc(doc(db, 'usernames', normalized), { uid: userId });

  // Update user doc
  await updateDoc(userRef(userId), {
    username: '@' + normalized,
    normalizedUsername: normalized,
  });
}

/**
 * Search people by username prefix.
 *
 * Reads publicProfiles rather than users: profile documents are owner-only, so
 * a query across the users collection is denied outright. Returns the public
 * view — identity plus whatever each person shares.
 */
export async function searchUsersByUsername(queryText: string): Promise<PublicProfile[]> {
  const cleanQuery = queryText.trim().toLowerCase().replace(/^@/, '');
  if (!cleanQuery) return [];
  const q = query(
    collection(db, 'publicProfiles'),
    where('normalizedUsername', '>=', cleanQuery),
    where('normalizedUsername', '<=', cleanQuery + '\uf8ff'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as PublicProfile);
}

/** Look up a user by exact username */
export async function getUserByUsername(username: string): Promise<User | null> {
  const normalized = normalizeUsername(username);
  const snap = await getDoc(doc(db, 'usernames', normalized));
  if (!snap.exists()) return null;
  const uid = snap.data().uid;
  return getUser(uid);
}
