/**
 * TEMPLATE — copy this file to `firebaseConfig.ts` and fill in your project's values.
 *
 *   cp src/config/firebaseConfig.example.ts src/config/firebaseConfig.ts
 *
 * Get these from: Firebase console → Project settings → "Your apps" → SDK setup & config.
 *
 * NOTE: these Firebase web-config values are NOT secrets (they ship in the client
 * anyway) — the real protection is Firestore Security Rules (see backend/firestore.rules).
 * We still keep the file out of git so each person points at their own project/env
 * and we don't hardcode one shared project.
 */
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
