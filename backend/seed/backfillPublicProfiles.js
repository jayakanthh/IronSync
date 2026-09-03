/**
 * Publish a public profile for every existing user.
 * Owner: jaikanth (backend).
 *
 * publicProfiles/{uid} is the only part of a person other people can read once
 * the real security rules are live — it's what makes friend search, avatars and
 * other people's profile pages work. Users who signed up before it existed have
 * none, so they'd be invisible.
 *
 * Run (needs ./serviceAccount.json):
 *   cd backend/seed && node backfillPublicProfiles.js --dry-run
 *   cd backend/seed && node backfillPublicProfiles.js
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');

// Mirrors DEFAULT_PRIVACY / toPublicProfile in the app — streak is shared with
// friends by default, and the old statsVisibleToFriends toggle still wins.
function sharesStreak(user) {
  if (user.statsVisibleToFriends === false) return false;
  const level = user.privacy?.streak ?? 'friends';
  return level !== 'only_me';
}

async function main() {
  const users = await db.collection('users').get();
  console.log(`${users.size} user(s)${DRY_RUN ? ' — dry run, nothing will be written' : ''}\n`);

  let written = 0;
  for (const doc of users.docs) {
    const u = doc.data();
    const pub = {
      userId: doc.id,
      displayName: u.displayName || 'Athlete',
      username: u.username || '',
      normalizedUsername:
        u.normalizedUsername || (u.username || '').toLowerCase().replace(/^@/, ''),
      photo: u.photoURL || '',
      updatedAt: Date.now(),
    };
    if (sharesStreak(u)) {
      pub.currentStreak = u.currentStreak ?? 0;
      pub.longestStreak = u.longestStreak ?? 0;
      if (u.lastTrainedDate) pub.lastTrainedDate = u.lastTrainedDate;
      pub.trainingDays = u.trainingDays ?? [];
    }

    console.log(`  ${pub.displayName} (${pub.username || 'no username'})${sharesStreak(u) ? ' + streak' : ''}`);
    if (!DRY_RUN) await db.doc(`publicProfiles/${doc.id}`).set(pub, { merge: true });
    written++;
  }

  console.log(`\n✅ ${written} public profile(s) ${DRY_RUN ? 'would be' : ''} written.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
