/**
 * Progress photos — the visual half of tracking a body change.
 * Owner: jaikanth (backend).
 *
 * Stored as downscaled data URIs on documents under the user, for the same
 * reason avatars are: creating a Cloud Storage bucket needs the Blaze plan.
 * A photo is capped well under Firestore's 1MiB document limit by resizing
 * before it ever gets here (see PHOTO_WIDTH).
 *
 * ⚠️ These are pictures of someone's body. They live under users/{uid}, which
 * firestore.rules keeps owner-only, and nothing copies them anywhere else.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import type { PhotoAngle, ProgressPhoto } from '../../models/index';
import { db } from '../../config/firebase';

/** Wide enough to compare on a phone, small enough to sit in a document. */
export const PHOTO_WIDTH = 720;
/** Refuse anything that would threaten the 1MiB document ceiling. */
const MAX_BYTES = 700 * 1024;

const photosCol = (userId: string) => collection(db, 'users', userId, 'progressPhotos');

export async function addProgressPhoto(
  userId: string,
  photo: Omit<ProgressPhoto, 'id' | 'createdAt'>,
): Promise<ProgressPhoto> {
  if (photo.image.length > MAX_BYTES) {
    throw new Error('That photo is too large even after resizing. Try another one.');
  }
  const ref = doc(photosCol(userId));
  const saved: ProgressPhoto = { ...photo, id: ref.id, createdAt: Date.now() };
  await setDoc(ref, saved);
  return saved;
}

/**
 * Newest first. Capped because each document carries its own image — the
 * gallery loads what it shows, not the whole history.
 */
export async function getProgressPhotos(userId: string, max = 24): Promise<ProgressPhoto[]> {
  const snap = await getDocs(query(photosCol(userId), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => d.data() as ProgressPhoto);
}

export async function deleteProgressPhoto(userId: string, photoId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'progressPhotos', photoId));
}

/** The two photos a comparison should open with: oldest and newest of an angle. */
export function bookendsFor(photos: ProgressPhoto[], angle: PhotoAngle): ProgressPhoto[] {
  const ofAngle = photos.filter((p) => p.angle === angle);
  if (ofAngle.length < 2) return ofAngle;
  return [ofAngle[ofAngle.length - 1], ofAngle[0]]; // list is newest-first
}
