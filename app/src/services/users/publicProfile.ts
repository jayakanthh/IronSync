/**
 * Profile photos.
 * Owner: jaikanth (backend).
 *
 * The image is downscaled to 256px and kept as a data URI — a few KB — rather
 * than uploaded to Cloud Storage, which this project can't use: creating a
 * bucket needs the Blaze plan.
 *
 * It's written twice, deliberately:
 *  · on the user's own profile, which is already loaded, so their own avatar
 *    renders with no extra read;
 *  · on publicProfiles/{uid}, which any signed-in user may read, because full
 *    profile documents are owner-only and friends still need a face and a name.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { PublicProfile, User } from '../../models/index';
import { db } from '../../config/firebase';
import { resolvePrivacy } from './privacy';
import { updateUser } from './users';

/** Big enough for a 52pt avatar on a 3x screen, small enough to inline. */
export const AVATAR_SIZE = 256;

const publicRef = (userId: string) => doc(db, 'publicProfiles', userId);

/** Fetched public profiles, so a friends list doesn't re-read one per row. */
const cache = new Map<string, PublicProfile | null>();

/**
 * Save a photo (already resized — see pickAvatar in SettingsScreen) and mirror
 * the readable copy other people use.
 */
export async function setAvatar(user: User, dataUri: string): Promise<void> {
  await updateUser(user.id, { photoURL: dataUri });
  await syncPublicProfile({ ...user, photoURL: dataUri });
}

export async function removeAvatar(user: User): Promise<void> {
  await updateUser(user.id, { photoURL: '' });
  await syncPublicProfile({ ...user, photoURL: '' });
}

/**
 * Build the publishable view of a user: identity always, plus whatever their
 * privacy settings say may be shared. Fields that aren't shared are written as
 * undefined-free omissions, so "not shared" and "zero" can't be confused.
 */
export function toPublicProfile(user: User): PublicProfile {
  const privacy = resolvePrivacy(user);
  const pub: PublicProfile = {
    userId: user.id,
    displayName: user.displayName,
    username: user.username ?? '',
    normalizedUsername: user.normalizedUsername ?? (user.username ?? '').toLowerCase().replace(/^@/, ''),
    photo: user.photoURL ?? '',
    updatedAt: Date.now(),
  };
  if (privacy.streak !== 'only_me') {
    pub.currentStreak = user.currentStreak ?? 0;
    pub.longestStreak = user.longestStreak ?? 0;
    pub.lastTrainedDate = user.lastTrainedDate;
    pub.trainingDays = user.trainingDays ?? [];
  }
  return pub;
}

/**
 * Keep the readable copy in step with the private profile. Cheap to call — it
 * only writes when something has actually changed.
 */
export async function syncPublicProfile(user: User): Promise<void> {
  const next = toPublicProfile(user);
  const existing = await getPublicProfile(user.id);
  if (existing && sameProfile(existing, next)) return;
  await setDoc(publicRef(user.id), stripUndefined(next), { merge: true });
  cache.set(user.id, next);
}

const sameProfile = (a: PublicProfile, b: PublicProfile) =>
  a.displayName === b.displayName &&
  (a.username ?? '') === (b.username ?? '') &&
  (a.photo ?? '') === (b.photo ?? '') &&
  a.currentStreak === b.currentStreak &&
  a.longestStreak === b.longestStreak &&
  a.lastTrainedDate === b.lastTrainedDate;

/** Firestore rejects undefined values outright. */
const stripUndefined = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (cache.has(userId)) return cache.get(userId) ?? null;
  try {
    const snap = await getDoc(publicRef(userId));
    const value = snap.exists() ? (snap.data() as PublicProfile) : null;
    cache.set(userId, value); // remember misses too, or we re-read forever
    return value;
  } catch (err: any) {
    console.warn('[getPublicProfile] failed:', err?.message ?? err);
    return null;
  }
}

/** Someone else's photo, or null if they haven't set one. */
export async function getAvatarUrl(userId: string): Promise<string | null> {
  const pub = await getPublicProfile(userId);
  return pub?.photo || null;
}
