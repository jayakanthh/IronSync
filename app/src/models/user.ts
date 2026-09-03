/** A person's profile. `id` comes from Firebase Auth. */
export type Goal = 'cut' | 'maintain' | 'bulk';

/** Weekday index: 0=Sunday .. 6=Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface User {
  id: string;
  displayName: string;
  email: string;
  age?: number;
  gender?: string;
  heightCm?: number;
  goal?: Goal;
  createdAt: number; // epoch ms
  onboarded?: boolean; // has the user completed the stats/schedule onboarding
  weightKg?: number; // latest known bodyweight (also snapshotted in measurements)
  activePlanId?: string; // the plan the user is currently following (drives "Today's Plan")
  // streak — "scheduled training days" model
  trainingDays: Weekday[]; // e.g. [1,3,5] = Mon/Wed/Fri; only these days affect the streak
  currentStreak: number; // consecutive scheduled days trained
  longestStreak: number;
  lastTrainedDate?: string; // YYYY-MM-DD
// social — a user can belong to several crews AND communities (separate concepts)
  groupIds: string[];
  communityIds?: string[]; // communities (gym, college, etc.) — distinct from crews
  savedPlanIds?: string[]; // public plans the user has bookmarked (Workouts > Saved tab)
  unitSystem?: 'metric' | 'imperial';
  statsVisibleToFriends?: boolean; // let friends see your streak/stats on your profile (default: visible)
  /** Per-area sharing. Anything unset falls back to the defaults in
   *  DEFAULT_PRIVACY — see services/users/privacy.ts. */
  privacy?: PrivacySettings;

  /** Download URL of the profile photo at avatars/{uid}. Absent = initials. */
  photoURL?: string;

  username?: string;
  normalizedUsername?: string;
  
  // body progress & energy profile
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
}

/** Who can see one kind of data. */
export type ShareLevel = 'only_me' | 'friends' | 'everyone';

/**
 * What you share, area by area. Health notes are deliberately absent: they are
 * never shareable, and firestore.rules keeps them owner-only regardless.
 */
export interface PrivacySettings {
  /** Your logged sessions in friends' feeds and on your profile. */
  workouts: ShareLevel;
  /** Personal records and the crew leaderboard. */
  personalRecords: ShareLevel;
  /** Current streak on your profile. */
  streak: ShareLevel;
  /** Bodyweight and measurements. */
  measurements: ShareLevel;
  /** Calories and macros. */
  nutrition: ShareLevel;
}

/** A body measurement snapshot over time. */
export interface Measurement {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg?: number;
  bodyParts?: {
    chest?: number;
    waist?: number;
    arms?: number;
    thighs?: number;
    [part: string]: number | undefined;
  };
}

/**
 * A private health note (injury, condition, limitation).
 * ⚠️ Sensitive — must stay readable ONLY by the owning user (see backend/firestore.rules).
 */
export interface HealthNote {
  id: string;
  note: string;
  createdAt: number;
}
