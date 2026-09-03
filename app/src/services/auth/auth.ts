/**
 * Auth service — sign up / sign in / sign out and the current user.
 * Owner: jaikanth (backend).
 *
 * Uses Firebase Auth (email + password to start; Google can be added later).
 * On sign-up we also create the user's Firestore profile document with sensible
 * defaults, so the rest of the app can assume a profile always exists.
 */
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../../config/firebase';
import { createUserProfile, updateUser } from '../users/users';

/** Create an account, set the display name, and seed the profile doc. */
export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await createUserProfile(cred.user.uid, { displayName, email });
  return cred.user.uid;
}

/** Sign in with email + password. Returns the user id. */
export async function signIn(email: string, password: string): Promise<string> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
}

/** Sign the current user out. */
export function signOutUser(): Promise<void> {
  return signOut(auth);
}

/** The currently signed-in user id, or null. */
export function currentUserId(): string | null {
  return auth.currentUser?.uid ?? null;
}

/**
 * Subscribe to auth changes (signed in / out). Call the returned function to
 * unsubscribe. The UI uses this to decide between the auth screen and the app.
 */
export function onAuthChange(cb: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

/**
 * Firebase requires a recent login before changing an email or password. Rather
 * than bounce the user out to sign in again, we re-authenticate in place with
 * the password they just typed.
 */
async function reauthenticate(currentPassword: string): Promise<FirebaseUser> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('You need to be signed in to do that.');
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, currentPassword),
  );
  return user;
}

/**
 * Start an email change. Firebase sends a verification link to the NEW address
 * and only switches it once that link is clicked — so a typo can't lock you out
 * of your own account, and nobody can move an account to an address they don't
 * control.
 *
 * The Firestore profile still holds the old address until then; syncEmail()
 * catches up once the change goes through.
 */
export async function changeEmail(newEmail: string, currentPassword: string): Promise<void> {
  const user = await reauthenticate(currentPassword);
  await verifyBeforeUpdateEmail(user, newEmail.trim());
}

/** Change the password, proving ownership with the current one. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = await reauthenticate(currentPassword);
  await updatePassword(user, newPassword);
}

/** Send a reset link — the way back in when the current password is forgotten. */
export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Copy the verified address from Auth into the profile document. Called after
 * sign-in: an email change is confirmed by clicking a link in a mail client,
 * which the app never sees, so this is where the two are reconciled.
 */
export async function syncEmail(userId: string, profileEmail?: string): Promise<string | null> {
  const authEmail = auth.currentUser?.email;
  if (!authEmail || authEmail === profileEmail) return null;
  await updateUser(userId, { email: authEmail });
  return authEmail;
}
