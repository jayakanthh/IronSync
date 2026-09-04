/**
 * CurrentUser context — the app's single source of "who's signed in".
 * Subscribes to Firebase auth once and loads the backend profile, so any screen
 * can read the real signed-in user. This is what connects the UI to the backend.
 * Owner: jaikanth (backend) + Pruthvi (UI).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../models';
import { getUser, onAuthChange, syncEmail, syncPublicProfile } from '../services';

interface CurrentUserState {
  loading: boolean; // still resolving auth state on launch
  authed: boolean; // is someone signed in
  profile: User | null; // their backend profile
  refresh: () => Promise<void>;
}

const Ctx = createContext<CurrentUserState>({
  loading: true,
  authed: false,
  profile: null,
  refresh: async () => {},
});

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    return onAuthChange(async (fbUser) => {
      if (fbUser) {
        setUid(fbUser.uid);
        setAuthed(true);
        const loaded = await getUser(fbUser.uid);
        // An email change is confirmed by clicking a link in a mail client, which
        // the app never sees — so the profile catches up here, at the next sign-in.
        const synced = loaded ? await syncEmail(fbUser.uid, loaded.email) : null;
        setProfile(synced && loaded ? { ...loaded, email: synced } : loaded);
        // Keep the copy other people can read in step with the private profile.
        // It only writes when something actually differs.
        if (loaded) {
          syncPublicProfile(loaded).catch((err) =>
            console.warn('[CurrentUser] public profile sync failed:', err?.message ?? err),
          );
        }
      } else {
        setUid(null);
        setAuthed(false);
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    if (uid) setProfile(await getUser(uid));
  };

  return <Ctx.Provider value={{ loading, authed, profile, refresh }}>{children}</Ctx.Provider>;
}

/** Read the signed-in user anywhere in the app. */
export function useCurrentUser(): CurrentUserState {
  return useContext(Ctx);
}
