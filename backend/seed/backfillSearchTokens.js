/**
 * Backfill `searchTokens` on food documents written before token search existed.
 * Owner: jaikanth (backend).
 *
 * Without it, `foods` and `customFoods` saved earlier can only be found by a
 * prefix of their full name — "milk" never matches "Amul Taaza Milk".
 *
 * Run (needs ./serviceAccount.json):
 *   cd backend/seed && node backfillSearchTokens.js --dry-run
 *   cd backend/seed && node backfillSearchTokens.js
 *
 * Safe to re-run: documents that already have tokens are left alone unless
 * you pass --force.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// ⚠️ Mirror of app/src/utils/formatting/searchTokens.ts — keep the rules in step.
const MIN_PREFIX = 3;
const MAX_TOKENS = 80;

function buildSearchTokens(...text) {
  const out = new Set();
  for (const part of text) {
    const wordList = (part || '')
      .toLowerCase()
      .replace(/[^a-z0-9%\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    for (const word of wordList) {
      if (word.length < MIN_PREFIX) {
        out.add(word);
        continue;
      }
      for (let i = MIN_PREFIX; i <= word.length; i++) out.add(word.slice(0, i));
    }
  }
  return Array.from(out).slice(0, MAX_TOKENS);
}

async function backfill(collectionRef, label) {
  const snap = await collectionRef.get();
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    const f = doc.data();
    if (!FORCE && Array.isArray(f.searchTokens) && f.searchTokens.length) {
      skipped++;
      continue;
    }
    const tokens = buildSearchTokens(f.name, f.brand);
    if (tokens.length === 0) {
      skipped++;
      continue;
    }
    if (!DRY_RUN) {
      batch.update(doc.ref, {
        searchTokens: tokens,
        // Older docs may predate this too; search's fallback scan needs it.
        normalizedName: f.normalizedName || (f.name || '').toLowerCase(),
      });
      inBatch++;
      if (inBatch >= 450) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
    updated++;
  }
  if (!DRY_RUN && inBatch > 0) await batch.commit();
  console.log(`${label}: ${updated} ${DRY_RUN ? 'would be updated' : 'updated'}, ${skipped} left alone`);
  return updated;
}

async function main() {
  console.log(DRY_RUN ? 'Dry run — nothing will be written.\n' : 'Backfilling search tokens…\n');

  let total = await backfill(db.collection('foods'), 'foods');

  const users = await db.collection('users').get();
  for (const user of users.docs) {
    const ref = db.collection('users').doc(user.id).collection('customFoods');
    const snap = await ref.limit(1).get();
    if (snap.empty) continue;
    total += await backfill(ref, `customFoods (${user.data().displayName || user.id})`);
  }

  console.log(`\n✅ ${total} document(s) ${DRY_RUN ? 'would be' : ''} backfilled.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
