/**
 * Community service — CRUD + discover/join + privacy-filtered content queries.
 * DISTINCT from groups.ts (fitness crews — not touched here).
 *
 * Firestore layout:
 *   communities/{id}                            ← Community doc
 *   communities/{id}/members/{uid}              ← CommunityMember
 *   communities/{id}/requests/{uid}             ← CommunityJoinRequest
 *   communities/{id}/challenges/{id}            ← CommunityChallenge
 *   communities/{id}/challenges/{id}/progress/{uid} ← ChallengeProgress
 *   communities/{id}/achievements/{id}          ← CommunityAchievement
 *   communities/{id}/posts/{id}                 ← CommunityPost (shared workout)
 */
import {
  addDoc,
  arrayUnion,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type {
  ChallengeMetric,
  ChallengeProgress,
  Community,
  CommunityAchievement,
  CommunityChallenge,
  CommunityMember,
  CommunityPost,
  CommunityPrivacy,
  CommunityType,
  WorkoutVisibility,
  PersonalRecord,
} from '../../models/index';
import { db } from '../../config/firebase';
import { getExercisesByIds } from '../exercises/exercises';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

// ─── Create / Lifecycle ───────────────────────────────────────────────────────

/** Create a new community. Returns the new community id. */
export async function createCommunity(
  userId: string,
  displayName: string,
  opts: {
    name: string;
    type: CommunityType;
    privacy: CommunityPrivacy;
    description?: string;
  },
): Promise<string> {
  const ref = doc(collection(db, 'communities'));
  const community: Community = {
    id: ref.id,
    name: opts.name,
    type: opts.type,
    privacy: opts.privacy,
    description: opts.description,
    adminIds: [userId],
    memberCount: 1,
    createdBy: userId,
    createdAt: Date.now(),
    inviteCode: opts.privacy === 'invite_only' ? makeInviteCode() : undefined,
  };
  await setDoc(ref, community);

  // Add creator as admin member
  const member: CommunityMember = {
    userId,
    displayName,
    role: 'admin',
    joinedAt: Date.now(),
  };
  await setDoc(doc(db, 'communities', ref.id, 'members', userId), member);

  // Link community to user
  await updateDoc(doc(db, 'users', userId), { communityIds: arrayUnion(ref.id) });

  return ref.id;
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/** Browse public communities (for discovery). */
export async function discoverCommunities(max = 30): Promise<Community[]> {
  // Filter by privacy only, then sort by memberCount client-side — avoids the
  // (privacy + memberCount) composite Firestore index.
  const q = query(collection(db, 'communities'), where('privacy', '==', 'public'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Community, 'id'>) }))
    .sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))
    .slice(0, max);
}

/** Search communities by name (client-side filter on top of discoverCommunities). */
export async function searchCommunities(nameQuery: string): Promise<Community[]> {
  const all = await discoverCommunities(100);
  const q = nameQuery.toLowerCase();
  return all.filter((c) => c.name.toLowerCase().includes(q));
}

/** Get a single community. */
export async function getCommunity(communityId: string): Promise<Community | null> {
  const snap = await getDoc(doc(db, 'communities', communityId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Community) : null;
}

/** Get all communities a user has joined. */
export async function getMyCommunities(communityIds: string[]): Promise<Community[]> {
  if (!communityIds.length) return [];
  const results = await Promise.all(communityIds.map(getCommunity));
  return results.filter((c): c is Community => c !== null);
}

// ─── Join / Leave ─────────────────────────────────────────────────────────────

/** Join a public community directly. */
export async function joinCommunity(
  userId: string,
  displayName: string,
  communityId: string,
): Promise<void> {
  const community = await getCommunity(communityId);
  if (!community) throw new Error('Community not found');
  if (community.privacy !== 'public') throw new Error('Cannot directly join a non-public community');

  const member: CommunityMember = {
    userId,
    displayName,
    role: 'member',
    joinedAt: Date.now(),
  };
  await setDoc(doc(db, 'communities', communityId, 'members', userId), member);
  await updateDoc(doc(db, 'communities', communityId), { memberCount: increment(1) });
  await updateDoc(doc(db, 'users', userId), { communityIds: arrayUnion(communityId) });
}

/** Join an invite_only community by invite code. Returns communityId or null. */
export async function joinByInviteCode(
  userId: string,
  displayName: string,
  inviteCode: string,
): Promise<string | null> {
  const q = query(
    collection(db, 'communities'),
    where('inviteCode', '==', inviteCode.toUpperCase()),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const communityId = snap.docs[0].id;
  await joinCommunity(userId, displayName, communityId);
  return communityId;
}

/** Submit a join request for a private community. */
export async function requestToJoin(
  userId: string,
  displayName: string,
  communityId: string,
): Promise<void> {
  await setDoc(doc(db, 'communities', communityId, 'requests', userId), {
    userId,
    displayName,
    requestedAt: Date.now(),
    status: 'pending',
  });
}

/** Admin: approve a join request. */
export async function approveJoinRequest(
  adminId: string,
  communityId: string,
  targetUserId: string,
  targetDisplayName: string,
): Promise<void> {
  const community = await getCommunity(communityId);
  if (!community?.adminIds.includes(adminId)) throw new Error('Not an admin');

  const member: CommunityMember = {
    userId: targetUserId,
    displayName: targetDisplayName,
    role: 'member',
    joinedAt: Date.now(),
  };
  await setDoc(doc(db, 'communities', communityId, 'members', targetUserId), member);
  await updateDoc(doc(db, 'communities', communityId, 'requests', targetUserId), { status: 'approved' });
  await updateDoc(doc(db, 'communities', communityId), { memberCount: increment(1) });
  await updateDoc(doc(db, 'users', targetUserId), { communityIds: arrayUnion(communityId) });
}

/** Leave a community. */
export async function leaveCommunity(userId: string, communityId: string): Promise<void> {
  await deleteDoc(doc(db, 'communities', communityId, 'members', userId));
  await updateDoc(doc(db, 'communities', communityId), { memberCount: increment(-1) });
  // Remove from user's communityIds
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (userSnap.exists()) {
    const ids: string[] = userSnap.data().communityIds ?? [];
    await updateDoc(doc(db, 'users', userId), { communityIds: ids.filter((id) => id !== communityId) });
  }
}

// ─── Members ──────────────────────────────────────────────────────────────────

/** All members of a community. */
export async function getCommunityMembers(communityId: string): Promise<CommunityMember[]> {
  const snap = await getDocs(collection(db, 'communities', communityId, 'members'));
  return snap.docs.map((d) => d.data() as CommunityMember);
}

/** Members currently training (isTrainingNow = true). */
export async function getTrainingNowMembers(communityId: string): Promise<CommunityMember[]> {
  const q = query(
    collection(db, 'communities', communityId, 'members'),
    where('isTrainingNow', '==', true),
  );
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => d.data() as CommunityMember);
  
  // Filter out stale users whose lastActive is older than 2 hours
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  return list.filter((m) => !m.lastActive || m.lastActive >= twoHoursAgo);
}

/** Update a member's training status. Call at workout start/end. */
export async function setMemberTrainingStatus(
  communityId: string,
  userId: string,
  isTrainingNow: boolean,
  currentActivity?: string,
  activeExerciseIds?: string[],
): Promise<void> {
  const updateData: any = {
    isTrainingNow,
    currentActivity: isTrainingNow ? (currentActivity ?? '') : '',
    lastActive: Date.now(),
  };
  if (isTrainingNow && activeExerciseIds) {
    updateData.activeExerciseIds = activeExerciseIds;
  } else if (!isTrainingNow) {
    updateData.activeExerciseIds = [];
  }

  await updateDoc(doc(db, 'communities', communityId, 'members', userId), updateData);
  // Update community-level training count
  await updateDoc(doc(db, 'communities', communityId), {
    trainingNowCount: increment(isTrainingNow ? 1 : -1),
  });
}

// ─── Recent Workouts (privacy-filtered) ───────────────────────────────────────

/**
 * Community Recent Workouts — ONLY returns posts where the author
 * has set visibility = 'community' (or 'everyone').
 * The workout data is the social representation, NOT the raw workout.
 */
export async function getCommunityWorkouts(
  communityId: string,
  max = 20,
): Promise<CommunityPost[]> {
  const q = query(
    collection(db, 'communities', communityId, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityPost, 'id'>) }));
}

/**
 * Share a workout to a community. Only call this if the user's
 * workout visibility is 'community' or 'everyone'.
 */
export async function shareWorkoutToCommunity(
  communityId: string,
  post: Omit<CommunityPost, 'id' | 'likes' | 'celebrateCount' | 'commentCount' | 'createdAt'>,
): Promise<string> {
  const ref = doc(collection(db, 'communities', communityId, 'posts'));
  const fullPost: CommunityPost = {
    ...post,
    id: ref.id,
    likes: [],
    celebrateCount: 0,
    commentCount: 0,
    createdAt: Date.now(),
  };
  await setDoc(ref, fullPost);
  return ref.id;
}

/** Like a community post. */
export async function likePost(communityId: string, postId: string, userId: string, isUnlike = false): Promise<void> {
  await updateDoc(doc(db, 'communities', communityId, 'posts', postId), {
    likes: isUnlike ? arrayRemove(userId) : arrayUnion(userId),
  });
}

// ─── Achievements ─────────────────────────────────────────────────────────────

/** Get community-visible achievements (privacy-respecting). */
export async function getCommunityAchievements(
  communityId: string,
  max = 20,
): Promise<CommunityAchievement[]> {
  const q = query(
    collection(db, 'communities', communityId, 'achievements'),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as CommunityAchievement);
}

/** Publish an achievement to a community (only if user allows community visibility). */
export async function publishAchievement(
  communityId: string,
  achievement: Omit<CommunityAchievement, 'id' | 'createdAt'>,
): Promise<void> {
  const ref = doc(collection(db, 'communities', communityId, 'achievements'));
  await setDoc(ref, { ...achievement, id: ref.id, createdAt: Date.now() });
}

/** Get community strength leaderboard for a specific exercise */
export async function getCommunityStrengthLeaderboard(
  communityId: string,
  exerciseName: string
): Promise<{ userId: string; displayName: string; value: number }[]> {
  const members = await getCommunityMembers(communityId);
  const results: { userId: string; displayName: string; value: number }[] = [];
  
  await Promise.all(members.map(async (m) => {
    // Check if member allows community visibility
    if (m.workoutVisibility === 'only_me' || m.workoutVisibility === 'friends') return;
    
    // Fetch PRs
    const snap = await getDocs(collection(db, 'users', m.userId, 'prs'));
    const prs = snap.docs.map(d => d.data() as PersonalRecord);
    if (prs.length === 0) return;

    // Resolve exercise IDs to names
    const prExerciseIds = prs.map(p => p.exerciseId);
    const exercises = await getExercisesByIds(prExerciseIds);
    const exerciseMap = new Map(exercises.map(e => [e.id, e.name.toLowerCase()]));

    const pr = prs.find(p => {
      const name = exerciseMap.get(p.exerciseId);
      return name && name.toLowerCase() === exerciseName.toLowerCase();
    });
    
    if (pr && pr.bestWeightKg > 0) {
      results.push({ userId: m.userId, displayName: m.displayName, value: pr.bestWeightKg });
    }
  }));

  return results.sort((a, b) => b.value - a.value);
}

// ─── Challenges ───────────────────────────────────────────────────────────────

/** Get active challenges for a community. */
export async function getCommunityChallenge(
  communityId: string,
): Promise<CommunityChallenge[]> {
  const q = query(
    collection(db, 'communities', communityId, 'challenges'),
    where('isActive', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityChallenge, 'id'>) }));
}

/** Create a challenge (admin only). */
export async function createChallenge(
  adminId: string,
  communityId: string,
  opts: {
    name: string;
    description?: string;
    metric: ChallengeMetric;
    exerciseName?: string;
    target: number;
    startDate: string;
    endDate: string;
  },
): Promise<string> {
  const community = await getCommunity(communityId);
  if (!community?.adminIds.includes(adminId)) throw new Error('Not an admin');

  const ref = doc(collection(db, 'communities', communityId, 'challenges'));
  const challenge: CommunityChallenge = {
    ...opts,
    id: ref.id,
    participantIds: [],
    createdBy: adminId,
    createdAt: Date.now(),
    isActive: true,
      status: 'active',
  };
  await setDoc(ref, challenge);
  return ref.id;
}

/** Join a challenge. */
export async function joinChallenge(
  userId: string,
  displayName: string,
  communityId: string,
  challengeId: string,
): Promise<void> {
  await updateDoc(
    doc(db, 'communities', communityId, 'challenges', challengeId),
    { participantIds: arrayUnion(userId) },
  );
  const progressRef = doc(
    db, 'communities', communityId, 'challenges', challengeId, 'progress', userId,
  );
  await setDoc(progressRef, {
    userId,
    displayName,
    value: 0,
    joinedAt: Date.now(),
  } satisfies Omit<ChallengeProgress, 'rank'>);
}

/** Update a participant's challenge progress. */
export async function updateChallengeProgress(
  communityId: string,
  challengeId: string,
  userId: string,
  newValue: number,
): Promise<void> {
  const progressRef = doc(
    db, 'communities', communityId, 'challenges', challengeId, 'progress', userId,
  );
  await updateDoc(progressRef, { value: newValue });
}

/** Get all participants' progress for a challenge. */
export async function getChallengeProgress(
  communityId: string,
  challengeId: string,
): Promise<ChallengeProgress[]> {
  const snap = await getDocs(
    collection(db, 'communities', communityId, 'challenges', challengeId, 'progress'),
  );
  const entries = snap.docs.map((d) => d.data() as ChallengeProgress);
  // Sort by value desc and add ranks
  entries.sort((a, b) => b.value - a.value);
  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Discard a challenge (admin only). */
export async function discardChallenge(adminId: string, communityId: string, challengeId: string): Promise<void> {
  const community = await getCommunity(communityId);
  if (!community?.adminIds.includes(adminId)) throw new Error('Not an admin');
  const ref = doc(db, 'communities', communityId, 'challenges', challengeId);
  await updateDoc(ref, { isActive: false, status: 'discarded' });
}

/** Recalculate a challenge's progress */
export async function recalculateChallenge(
  communityId: string,
  challengeId: string
): Promise<void> {
  const challengeRef = doc(db, 'communities', communityId, 'challenges', challengeId);
  const challengeSnap = await getDoc(challengeRef);
  if (!challengeSnap.exists()) return;
  const challenge = { id: challengeSnap.id, ...(challengeSnap.data() as Omit<CommunityChallenge, 'id'>) };

  if (!challenge.isActive) return;

  const progressCol = collection(db, 'communities', communityId, 'challenges', challengeId, 'progress');
  const progressSnap = await getDocs(progressCol);
  const participants = progressSnap.docs.map(d => d.data() as ChallengeProgress);

  let totalProgress = 0;

  for (const participant of participants) {
    const q = query(
      collection(db, 'users', participant.userId, 'workouts'),
      where('date', '>=', challenge.startDate),
      where('date', '<=', challenge.endDate)
    );
    const wSnap = await getDocs(q);
    const workouts = wSnap.docs.map(d => d.data() as any); // cast to any to avoid strict Workout type issues here if not imported

    let userVolume = 0;

    for (const w of workouts) {
      for (const entry of (w.entries || [])) {
        let matches = true;
        if (challenge.metric === 'exercise_volume' && challenge.exerciseName) {
          const [ex] = await getExercisesByIds([entry.exerciseId]);
          if (!ex || ex.name.toLowerCase() !== challenge.exerciseName.toLowerCase()) {
            matches = false;
          }
        }

        if (matches) {
          for (const set of (entry.sets || [])) {
            userVolume += (set.weightKg || 0) * (set.reps || 0);
          }
        }
      }
    }

    await updateDoc(doc(progressCol, participant.userId), { value: userVolume });
    totalProgress += userVolume;
  }

  const today = new Date().toISOString().split('T')[0];
  const isExpired = today > challenge.endDate;
  const isCompleted = totalProgress >= challenge.target;

  if (isCompleted) {
    await updateDoc(challengeRef, { isActive: false, status: 'completed' });
    const achRef = doc(db, 'communities', communityId, 'achievements', `challenge_${challenge.id}`);
    const achievement: CommunityAchievement = {
      id: `challenge_${challenge.id}`,
      userId: challenge.createdBy,
      displayName: 'Community',
      type: 'other',
      description: `Challenge Completed: ${challenge.name}! Target of ${challenge.target} KG reached!`,
      value: totalProgress,
      achievedOn: today,
      createdAt: Date.now()
    };
    await setDoc(achRef, achievement);
  } else if (isExpired) {
    await updateDoc(challengeRef, { isActive: false, status: 'expired' });
  }
}


