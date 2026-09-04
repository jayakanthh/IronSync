/**
 * Seed the food library from Open Food Facts (ODbL — attribution required).
 * Owner: jaikanth (backend). Source: https://world.openfoodfacts.org
 *
 * Packaged products only — that's all OFF has. Home-cooked food is added by
 * users as custom foods.
 *
 * Run (needs ./serviceAccount.json — see README):
 *   cd backend/seed && node seedOpenFoodFacts.js                 # India, up to 15k
 *   node seedOpenFoodFacts.js --country=india --max=5000
 *   node seedOpenFoodFacts.js --dry-run                          # fetch, write nothing
 *
 * It resumes: progress is kept in .off-seed-progress.json, so if you stop it —
 * or hit Spark's 20,000 writes/day — just run it again tomorrow.
 *
 * OFF allows 10 search requests/minute per IP and bans over it, so this waits
 * ~7s between pages. A full India pass is ~230 pages, so roughly half an hour.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const COUNTRY = arg('country', 'india');
const MAX_WRITES = parseInt(arg('max', '15000'), 10);
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE_SIZE = 100;
const REQUEST_GAP_MS = 7000; // stays under OFF's 10 requests/minute
const BATCH_SIZE = 450; // Firestore caps a batch at 500
const PROGRESS_FILE = path.join(__dirname, '.off-seed-progress.json');
const USER_AGENT = 'IronSync/1.0 (github.com/jayakanthh/IronSync)';

const FIELDS = [
  'code',
  'product_name',
  'brands',
  'categories',
  'quantity',
  'nutriments',
  'image_front_small_url',
].join(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Search tokens ───────────────────────────────────────────────────────────
// ⚠️ Mirror of app/src/utils/formatting/searchTokens.ts. Separate packages, so
// if the rules change there, change them here or seeded foods stop matching
// the same queries as user-created ones.
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

// ── Mapping ─────────────────────────────────────────────────────────────────
const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};

/** OFF product → our FoodProduct, or null if there's nothing worth logging. */
function toFoodProduct(p) {
  const name = (p.product_name || '').trim();
  if (!name || !p.code) return null;

  const n = p.nutriments || {};
  const calories = num(n['energy-kcal_100g']);
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  // No macros at all means the entry is a stub — skip it rather than seed zeros.
  if (!calories && !protein && !carbs && !fat) return null;

  // OFF is crowdsourced and some entries are simply wrong — there are two
  // Parle-G records, one at 454 kcal/100g and one at 3.4. Reject anything that
  // can't be food: nothing edible passes ~900 kcal/100g (pure fat), and the
  // stated energy should be in the region of what its own macros imply.
  if (calories > 900) return null;
  const impliedKcal = protein * 4 + carbs * 4 + fat * 9;
  if (impliedKcal >= 50 && (calories < impliedKcal * 0.5 || calories > impliedKcal * 2)) return null;
  if (!calories && impliedKcal < 50) return null;

  const brand = (p.brands || '').split(',')[0].trim() || undefined;
  return {
    id: `off_${p.code}`,
    name,
    normalizedName: name.toLowerCase(),
    brand,
    category: (p.categories || '').split(',')[0].trim() || undefined,
    servingSize: 100,
    servingUnit: 'g',
    calories,
    protein,
    carbs,
    fat,
    fiber: n.fiber_100g != null ? num(n.fiber_100g) : undefined,
    sugar: n.sugars_100g != null ? num(n.sugars_100g) : undefined,
    // OFF reports sodium in grams; we store milligrams.
    sodium: n.sodium_100g != null ? Math.round(num(n.sodium_100g) * 1000) : undefined,
    barcode: String(p.code),
    image: p.image_front_small_url || undefined,
    searchTokens: buildSearchTokens(name, brand),
    source: 'openfoodfacts',
    verified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Firestore rejects undefined; drop those keys rather than storing nulls. */
const compact = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// ── Fetching ────────────────────────────────────────────────────────────────
async function fetchPage(page, attempt = 1) {
  const url =
    `https://world.openfoodfacts.org/api/v2/search?countries_tags_en=${encodeURIComponent(COUNTRY)}` +
    `&fields=${FIELDS}&page_size=${PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (res.status === 429 || res.status >= 500) {
    if (attempt > 5) throw new Error(`OFF kept failing on page ${page} (${res.status})`);
    const backoff = REQUEST_GAP_MS * attempt * 2;
    console.log(`  ⚠️  ${res.status} on page ${page}; retrying in ${backoff / 1000}s`);
    await sleep(backoff);
    return fetchPage(page, attempt + 1);
  }
  if (!res.ok) throw new Error(`OFF request failed: ${res.status}`);
  return res.json();
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { page: 1, written: 0, skipped: 0 };
  }
}

async function main() {
  const progress = loadProgress();
  console.log(
    `Seeding Open Food Facts — country: ${COUNTRY}, cap: ${MAX_WRITES} writes` +
      `${DRY_RUN ? ' (dry run)' : ''}`,
  );
  if (progress.page > 1) console.log(`Resuming at page ${progress.page} (${progress.written} written so far).`);

  let writtenThisRun = 0;
  let batch = db.batch();
  let inBatch = 0;

  const commit = async () => {
    if (inBatch === 0 || DRY_RUN) return;
    await batch.commit();
    batch = db.batch();
    inBatch = 0;
  };

  while (writtenThisRun < MAX_WRITES) {
    const json = await fetchPage(progress.page);
    const products = json.products || [];
    if (products.length === 0) {
      console.log('No more products — done.');
      break;
    }

    for (const p of products) {
      const food = toFoodProduct(p);
      if (!food) {
        progress.skipped++;
        continue;
      }
      if (!DRY_RUN) batch.set(db.doc(`foods/${food.id}`), compact(food), { merge: true });
      inBatch++;
      writtenThisRun++;
      progress.written++;
      if (inBatch >= BATCH_SIZE) await commit();
      if (writtenThisRun >= MAX_WRITES) break;
    }

    console.log(
      `  page ${progress.page}/${Math.ceil((json.count || 0) / PAGE_SIZE)} — ` +
        `${progress.written} kept, ${progress.skipped} skipped (no name, no macros, or numbers that don't add up)`,
    );
    progress.page++;
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

    if (writtenThisRun >= MAX_WRITES) {
      console.log(`\nHit the ${MAX_WRITES}-write cap for this run. Run again to continue.`);
      break;
    }
    await sleep(REQUEST_GAP_MS);
  }

  await commit();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  console.log(
    `\n✅ ${DRY_RUN ? 'Would have written' : 'Wrote'} ${writtenThisRun} foods this run ` +
      `(${progress.written} total, ${progress.skipped} skipped).`,
  );
  console.log('Data © Open Food Facts contributors, ODbL — keep the attribution in the app.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
