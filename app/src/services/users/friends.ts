/**
 * Friends service — 1-to-1 friend requests & friendships.
 * Owner: jaikanth (backend).
 *
 * Requests: friendRequests/{id} { fromId, toId, ... }.
 * Friendships: friendships/{sortedPairId} { members:[a,b], names, since } — keyed
 * by the sorted id pair so either friend can read/write it.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { FriendRequest, Friendship } from '../../models/index';
import { db } from '../../config/firebase';
import { createNotification } from '../notifications/notification';
import { getUser } from './users';

const pairId = (a: string, b: string) => [a, b].sort().join('_');

export async function getIncomingRequests(userId: string): Promise<FriendRequest[]> {
  const snap = await getDocs(
    query(collection(db, 'friendRequests'), where('toId', '==', userId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) }));
}

/** Accept a request → create the friendship, remove the request. */
export async function acceptRequest(req: FriendRequest): Promise<void> {
  const id = pairId(req.fromId, req.toId);
  const friendship: Friendship = {
    id,
    members: [req.fromId, req.toId],
    names: { [req.fromId]: req.fromName, [req.toId]: req.toName },
    since: Date.now(),
  };
  await setDoc(doc(db, 'friendships', id), friendship);
  await deleteDoc(doc(db, 'friendRequests', req.id));

  // Trigger notification
  await createNotification(req.fromId, {
    fromUserId: req.toId,
    fromUserName: req.toName,
    title: 'Friend Request Accepted',
    body: `${req.toName} accepted your friend request.`,
    type: 'friend_accepted',
  });
}

/** Decline (delete) a request. */
export async function declineRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'friendRequests', requestId));
}

/** This user's friends (mapped to the other person). */
export async function getFriends(
  userId: string,
): Promise<{ friendId: string; name: string; since: number }[]> {
  const snap = await getDocs(
    query(collection(db, 'friendships'), where('members', 'array-contains', userId)),
  );
  return snap.docs.map((d) => {
    const f = d.data() as Friendship;
    const friendId = f.members.find((m) => m !== userId) ?? userId;
    return { friendId, name: f.names[friendId] ?? 'Friend', since: f.since };
  });
}

/** Remove a friend (deletes the friendship both ways). */
export async function removeFriend(userId: string, friendId: string): Promise<void> {
  await deleteDoc(doc(db, 'friendships', pairId(userId, friendId)));
}

/** Check if two users are friends (bidirectional check) */
export async function areFriends(userIdA: string, userIdB: string): Promise<boolean> {
  const id = pairId(userIdA, userIdB);
  const snap = await getDoc(doc(db, 'friendships', id));
  return snap.exists();
}

/** Send a friend request to a user by their UID. Returns an error message or null on success. */
export async function sendFriendRequestByUid(
  from: { id: string; name: string },
  toId: string,
): Promise<string | null> {
  if (from.id === toId) return "That's you!";

  // Check if they are already friends
  const isFriend = await areFriends(from.id, toId);
  if (isFriend) return 'You two are already friends.';

  // Check if request already sent or received
  const [sent, received] = await Promise.all([
    getDocs(query(collection(db, 'friendRequests'), where('fromId', '==', from.id), where('toId', '==', toId), limit(1))),
    getDocs(query(collection(db, 'friendRequests'), where('fromId', '==', toId), where('toId', '==', from.id), limit(1))),
  ]);

  if (!sent.empty) return 'Friend request already sent.';
  if (!received.empty) return 'You have a pending friend request from this user.';

  // Get recipient profile for display name
  const recipient = await getUser(toId);
  const toName = recipient?.displayName || 'Lifter';

  const ref = await addDoc(collection(db, 'friendRequests'), {
    fromId: from.id,
    fromName: from.name,
    toId,
    toName,
    createdAt: Date.now(),
  });

  // Trigger notification
  await createNotification(toId, {
    fromUserId: from.id,
    fromUserName: from.name,
    title: 'Friend Request',
    body: `${from.name} sent you a friend request.`,
    type: 'friend_request',
    data: { friendRequestId: ref.id }
  });

  return null;
}
