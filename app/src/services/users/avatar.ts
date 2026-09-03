/**
 * Profile photos.
 * Owner: jaikanth (backend).
 *
 * One image per user at `avatars/{uid}` in Cloud Storage, overwritten on change
 * (see backend/storage.rules). The download URL is also kept on the user's
 * profile so their own screens don't need a Storage round trip.
 *
 * Friends can't read each other's profile documents — those are owner-only —
 * so someone else's photo is fetched straight from Storage by uid instead.
 */
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { updateUser } from './users';

const avatarRef = (userId: string) => ref(storage, `avatars/${userId}`);

/**
 * Upload a picked image and return its URL.
 *
 * `localUri` comes from expo-image-picker; fetch().blob() is how you turn that
 * into something the Storage SDK will take in React Native.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  await uploadBytes(avatarRef(userId), blob, { contentType: blob.type || 'image/jpeg' });
  const url = await getDownloadURL(avatarRef(userId));
  await updateUser(userId, { photoURL: url });
  cache.set(userId, url);
  return url;
}

export async function removeAvatar(userId: string): Promise<void> {
  try {
    await deleteObject(avatarRef(userId));
  } catch {
    // Already gone — clearing the profile field is what actually matters.
  }
  await updateUser(userId, { photoURL: '' });
  cache.set(userId, null);
}

/** Resolved URLs, so a list of friends doesn't hit Storage once per row per render. */
const cache = new Map<string, string | null>();

/** Someone else's avatar URL, or null if they haven't set one. */
export async function getAvatarUrl(userId: string): Promise<string | null> {
  if (cache.has(userId)) return cache.get(userId) ?? null;
  try {
    const url = await getDownloadURL(avatarRef(userId));
    cache.set(userId, url);
    return url;
  } catch {
    cache.set(userId, null); // no photo — remember that too, or we retry forever
    return null;
  }
}
