/**
 * Firebase initialization — the app's connection to the backend.
 * Owner: jaikanth (backend).
 *
 * The real config values are NOT committed. Copy `firebaseConfig.example.ts`
 * to `firebaseConfig.ts`, paste the values from the Firebase console, and
 * you're connected. `firebaseConfig.ts` is gitignored.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);

// getReactNativePersistence ships in firebase/auth's React Native build but isn't
// in the default TS types (Metro resolves the RN build at runtime), so we grab it
// off the namespace to keep tsc happy.
const getRNPersistence = (fbAuth as unknown as {
  getReactNativePersistence: (s: unknown) => unknown;
}).getReactNativePersistence;

/**
 * Firebase Auth. On native we use AsyncStorage persistence so the login survives
 * app restarts; on web, getAuth already persists. The try/catch handles Fast
 * Refresh re-running this module (initializeAuth can only be called once).
 */
function makeAuth() {
  if (Platform.OS === 'web') return fbAuth.getAuth(app);
  try {
    return fbAuth.initializeAuth(app, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      persistence: getRNPersistence(AsyncStorage) as any,
    });
  } catch {
    return fbAuth.getAuth(app);
  }
}
export const auth = makeAuth();

/**
 * Cloud Firestore instance (see docs/DATA_MODEL.md).
 * ignoreUndefinedProperties: drop undefined fields instead of throwing, so
 * optional profile fields (age, height…) left blank don't break a write.
 * The try/catch guards against Fast Refresh re-running this module.
 */
function makeDb() {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
}
export const db = makeDb();

/** Cloud Storage — profile photos live at avatars/{uid} (see backend/storage.rules). */
export const storage = getStorage(app);

export default app;
