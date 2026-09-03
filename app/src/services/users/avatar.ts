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
import type { PublicProfile } from '../../models/index';
import { db } from '../../config/firebase';
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
export async function setAvatar(
  userId: string,
  dataUri: string,
  displayName: string,
  username?: string,
): Promise<void> {
  await updateUser(userId, { photoURL: dataUri });
  const pub: PublicProfile = {
    userId,
    displayName,
    username,
    photo: dataUri,
    updatedAt: Date.now(),
  };
  await setDoc(publicRef(userId), pub, { merge: true });
  cache.set(userId, pub);
}

export async function removeAvatar(
  userId: string,
  displayName: string,
  username?: string,
): Promise<void> {
  await updateUser(userId, { photoURL: '' });
  const pub: PublicProfile = { userId, displayName, username, photo: '', updatedAt: Date.now() };
  await setDoc(publicRef(userId), pub, { merge: true });
  cache.set(userId, pub);
}

/**
 * Keep the public copy in step with the name/username on the private profile.
 * Cheap to call — it only writes when something actually differs.
 */
export async function syncPublicProfile(
  userId: string,
  displayName: string,
  username?: string,
  photo?: string,
): Promise<void> {
  const existing = await getPublicProfile(userId);
  if (
    existing &&
    existing.displayName === displayName &&
    existing.username === username &&
    (existing.photo ?? '') === (photo ?? '')
  ) {
    return;
  }
  const pub: PublicProfile = { userId, displayName, username, photo: photo ?? '', updatedAt: Date.now() };
  await setDoc(publicRef(userId), pub, { merge: true });
  cache.set(userId, pub);
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (cache.has(userId)) return cache.get(userId) ?? null;
  try {
    const snap = await getDoc(publicRef(userId));
    const value = snap.exists() ? (snap.data() as PublicProfile) : null;
    cache.set(userId, value); // remember misses too, or we re-read forever
    return value;
  } catch {
    return null;
  }
}

/** Someone else's photo, or null if they haven't set one. */
export async function getAvatarUrl(userId: string): Promise<string | null> {
  const pub = await getPublicProfile(userId);
  return pub?.photo || null;
}
