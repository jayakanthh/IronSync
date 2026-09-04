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
  const ofAngle = photos
    .filter((p) => p.angle === angle)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (ofAngle.length < 2) return ofAngle;
  return [ofAngle[0], ofAngle[ofAngle.length - 1]];
}

/** One row per day, newest first, with each angle in its slot or absent. */
export interface PhotoDay {
  date: string;
  front?: ProgressPhoto;
  side?: ProgressPhoto;
  back?: ProgressPhoto;
}

export function groupByDate(photos: ProgressPhoto[]): PhotoDay[] {
  const byDate = new Map<string, PhotoDay>();
  for (const p of photos) {
    const row = byDate.get(p.date) ?? { date: p.date };
    row[p.angle] = p;
    byDate.set(p.date, row);
  }
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The date a photo was actually taken, from its EXIF. Backdating an old photo
 * shouldn't mean typing a date the file already knows.
 *
 * EXIF dates look like "2026:08:12 07:41:03" — colons in the date part, which
 * is why this can't just be handed to Date().
 */
export function exifDate(exif: Record<string, any> | null | undefined): string | null {
  const raw = exif?.DateTimeOriginal ?? exif?.DateTime ?? exif?.DateTimeDigitized;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  // Guard against a camera clock set to 1970 or the future.
  const year = Number(m[1]);
  if (year < 2000 || year > new Date().getFullYear()) return null;
  return iso;
}

/** How far from a photo's date a weigh-in can be and still describe it. */
const WEIGHT_WINDOW_DAYS = 14;

/**
 * The logged bodyweight that best describes a photo's date.
 *
 * A photo from August should carry August's weight, not today's — so this looks
 * for the nearest weigh-in either side of that day and gives up rather than
 * guessing if the closest one is a fortnight away.
 */
export function weightNearDate(
  history: { value: number; recordedAt: number }[],
  isoDate: string,
): number | null {
  if (!history.length) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d, 12).getTime();

  let best: { value: number; gap: number } | null = null;
  for (const entry of history) {
    const gap = Math.abs(entry.recordedAt - target);
    if (!best || gap < best.gap) best = { value: entry.value, gap };
  }
  if (!best) return null;
  return best.gap <= WEIGHT_WINDOW_DAYS * 24 * 60 * 60 * 1000 ? best.value : null;
}
