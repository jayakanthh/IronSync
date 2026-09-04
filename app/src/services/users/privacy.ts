/**
 * Privacy settings — what a user shares, and with whom.
 * Owner: jaikanth (backend).
 *
 * These are the user's intent. Enforcement lives in firestore.rules and in the
 * queries that read other people's data; a setting here that isn't backed by a
 * rule is a promise the app can't keep, so anything added must be enforced too.
 */
import type { PrivacySettings, ShareLevel, User } from '../../models/index';
import { updateUser } from './users';

/**
 * Defaults for anyone who has never opened the privacy screen.
 *
 * Training is shared with friends — that's the point of a crew — while
 * bodyweight and food, which people are touchier about, start private.
 */
export const DEFAULT_PRIVACY: PrivacySettings = {
  workouts: 'friends',
  personalRecords: 'friends',
  streak: 'friends',
  measurements: 'only_me',
  nutrition: 'only_me',
};

/** A user's settings with every gap filled in, so callers never see undefined. */
export function resolvePrivacy(user?: Pick<User, 'privacy' | 'statsVisibleToFriends'> | null): PrivacySettings {
  const stored = user?.privacy ?? {};
  const resolved = { ...DEFAULT_PRIVACY, ...stored };
  // The old single toggle predates these settings — while it's off, it still
  // wins, so nobody's existing choice is quietly reversed by an upgrade.
  if (user?.statsVisibleToFriends === false) {
    return { ...resolved, streak: 'only_me', personalRecords: 'only_me' };
  }
  return resolved;
}

export async function setPrivacy(
  userId: string,
  current: PrivacySettings,
  key: keyof PrivacySettings,
  value: ShareLevel,
): Promise<PrivacySettings> {
  const next = { ...current, [key]: value };
  await updateUser(userId, { privacy: next });
  return next;
}

/** Can `viewer` see this area, given the owner's settings? */
export function canSee(
  privacy: PrivacySettings,
  key: keyof PrivacySettings,
  relationship: 'self' | 'friend' | 'stranger',
): boolean {
  if (relationship === 'self') return true;
  const level = privacy[key];
  if (level === 'everyone') return true;
  if (level === 'friends') return relationship === 'friend';
  return false;
}
