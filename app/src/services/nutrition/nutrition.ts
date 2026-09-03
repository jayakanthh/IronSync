import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  limit,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import type { FoodLogEntry, NutritionTargets, FoodProduct, SavedMeal, SavedMealItem, WaterPrefs } from '../../models/index';
import { db } from '../../config/firebase';
import { buildSearchTokens, queryToken } from '../../utils/formatting/searchTokens';

const targetsRef = (userId: string) =>
  doc(db, 'users', userId, 'meta', 'nutritionTargets');

/** Set the user's daily calorie & macro targets. */
export async function setNutritionTargets(
  userId: string,
  targets: NutritionTargets,
): Promise<void> {
  await setDoc(targetsRef(userId), targets);
}

/** Read the user's targets, or null if not set yet. */
export async function getNutritionTargets(
  userId: string,
): Promise<NutritionTargets | null> {
  const snap = await getDoc(targetsRef(userId));
  return snap.exists() ? (snap.data() as NutritionTargets) : null;
}

/** Log a food entry. */
export async function logFood(
  userId: string,
  entry: Omit<FoodLogEntry, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', userId, 'foodLog'), {
    ...entry,
    createdAt: Date.now(),
  });
  return ref.id;
}

/** All food entries for a given day (YYYY-MM-DD). */
export async function getFoodLog(userId: string, date: string): Promise<FoodLogEntry[]> {
  const q = query(collection(db, 'users', userId, 'foodLog'), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FoodLogEntry, 'id'>) }));
}

/**
 * Every entry between two days (inclusive), for the reports view. One range
 * query beats one request per day — the month view used to fire 30 of them.
 */
export async function getFoodLogRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<FoodLogEntry[]> {
  const q = query(
    collection(db, 'users', userId, 'foodLog'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FoodLogEntry, 'id'>) }));
}

/** Delete a food entry. */
export async function deleteFood(userId: string, entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'foodLog', entryId));
}

/** Sum a day's food into running totals — handy for the UI's progress rings. */
export function sumDay(entries: FoodLogEntry[]): NutritionTargets {
  return entries.reduce(
    (acc, e) => ({
      dailyCalories: acc.dailyCalories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
      fiberG: acc.fiberG + (e.fiberG ?? 0),
    }),
    { dailyCalories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
}

/** The micronutrients we carry but don't have targets for. */
export function sumMicros(entries: FoodLogEntry[]): { sugarG: number; sodiumMg: number } {
  return entries.reduce(
    (acc, e) => ({
      sugarG: acc.sugarG + (e.sugarG ?? 0),
      sodiumMg: acc.sodiumMg + (e.sodiumMg ?? 0),
    }),
    { sugarG: 0, sodiumMg: 0 },
  );
}

// ─── Water ───────────────────────────────────────────────────────────────────

const waterRef = (userId: string, date: string) => doc(db, 'users', userId, 'water', date);

/** A day's water intake in ml (0 if nothing logged). */
export async function getWater(userId: string, date: string): Promise<number> {
  const snap = await getDoc(waterRef(userId, date));
  return snap.exists() ? ((snap.data() as { ml?: number }).ml ?? 0) : 0;
}

/** Overwrite a day's water intake. Never goes negative. */
export async function setWater(userId: string, date: string, ml: number): Promise<void> {
  await setDoc(waterRef(userId, date), { date, ml: Math.max(0, Math.round(ml)), updatedAt: Date.now() });
}

const waterPrefsRef = (userId: string) => doc(db, 'users', userId, 'meta', 'waterPrefs');

/** The user's own water target and quick-add size, or null if never set. */
export async function getWaterPrefs(userId: string): Promise<WaterPrefs | null> {
  const snap = await getDoc(waterPrefsRef(userId));
  return snap.exists() ? (snap.data() as WaterPrefs) : null;
}

export async function setWaterPrefs(userId: string, prefs: WaterPrefs): Promise<void> {
  await setDoc(waterPrefsRef(userId), {
    targetMl: Math.max(100, Math.round(prefs.targetMl)),
    incrementMl: Math.max(10, Math.round(prefs.incrementMl)),
  });
}

/**
 * A sensible daily water target: ~35ml per kg of bodyweight, rounded to the
 * nearest 100ml and kept inside 2–4L. Falls back to 2.5L with no weight on file.
 */
export function suggestWaterTarget(weightKg?: number): number {
  if (!weightKg) return 2500;
  const raw = weightKg * 35;
  return Math.min(4000, Math.max(2000, Math.round(raw / 100) * 100));
}

// ─── Saved meals ─────────────────────────────────────────────────────────────

const savedMealsCol = (userId: string) => collection(db, 'users', userId, 'savedMeals');

/** Save a set of logged foods as a reusable meal. Returns the new id. */
export async function saveMeal(
  userId: string,
  name: string,
  items: SavedMealItem[],
): Promise<string> {
  const ref = await addDoc(savedMealsCol(userId), { name, items, createdAt: Date.now() });
  return ref.id;
}

/** Your saved meals, newest first. */
export async function getSavedMeals(userId: string): Promise<SavedMeal[]> {
  const snap = await getDocs(savedMealsCol(userId));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SavedMeal, 'id'>) }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function deleteSavedMeal(userId: string, mealId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'savedMeals', mealId));
}

/** Log every food in a saved meal into one meal slot on one day. */
export async function logSavedMeal(
  userId: string,
  meal: SavedMeal,
  date: string,
  slot: FoodLogEntry['meal'],
): Promise<void> {
  await Promise.all(meal.items.map((item) => logFood(userId, { ...item, date, meal: slot })));
}

/**
 * Re-log everything you ate in one meal slot on another day — "same breakfast
 * as yesterday". Returns how many entries were copied.
 */
export async function copyMealFromDate(
  userId: string,
  fromDate: string,
  toDate: string,
  slot: FoodLogEntry['meal'],
): Promise<number> {
  const source = (await getFoodLog(userId, fromDate)).filter((e) => e.meal === slot);
  await Promise.all(
    source.map(({ id, createdAt, ...item }) => logFood(userId, { ...item, date: toDate, meal: slot })),
  );
  return source.length;
}

// ─── Food Database & Search ──────────────────────────────────────────────────

/** Seed initial realistic foods if the foods collection is completely empty. */
export async function seedFoodDatabase(): Promise<void> {
  const checkQ = query(collection(db, 'foods'), limit(1));
  const checkSnap = await getDocs(checkQ);
  if (!checkSnap.empty) return; // already seeded

  const batch = writeBatch(db);
  // Tokens are added below, so anything seeded here is searchable by any word
  // in its name, not just the first one.
  const seedItems: Omit<FoodProduct, 'id'>[] = [
    {
      name: 'Heritage Toned Milk',
      normalizedName: 'heritage toned milk',
      brand: 'Heritage',
      category: 'Dairy',
      servingSize: 100,
      servingUnit: 'ml',
      calories: 60,
      protein: 3.1,
      carbs: 4.7,
      fat: 3.0,
      verified: true,
      source: 'seeded',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'Amul Taaza Milk',
      normalizedName: 'amul taaza milk',
      brand: 'Amul',
      category: 'Dairy',
      servingSize: 100,
      servingUnit: 'ml',
      calories: 58,
      protein: 3.0,
      carbs: 4.7,
      fat: 3.1,
      verified: true,
      source: 'seeded',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'Amul Gold Milk',
      normalizedName: 'amul gold milk',
      brand: 'Amul',
      category: 'Dairy',
      servingSize: 100,
      servingUnit: 'ml',
      calories: 87,
      protein: 3.2,
      carbs: 4.8,
      fat: 6.0,
      verified: true,
      source: 'seeded',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'Generic Toned Milk',
      normalizedName: 'generic toned milk',
      brand: 'Generic',
      category: 'Dairy',
      servingSize: 100,
      servingUnit: 'ml',
      calories: 59,
      protein: 3.0,
      carbs: 4.7,
      fat: 3.0,
      verified: true,
      source: 'seeded',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'Chicken Breast (Raw)',
      normalizedName: 'chicken breast raw',
      brand: 'Generic',
      category: 'Poultry',
      servingSize: 100,
      servingUnit: 'g',
      calories: 120,
      protein: 26.0,
      carbs: 0.0,
      fat: 1.5,
      verified: true,
      source: 'seeded',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'Roasted Sweet Potato',
      normalizedName: 'roasted sweet potato',
      brand: 'Generic',
      category: 'Vegetable',
      servingSize: 100,
      servingUnit: 'g',
      calories: 86,
      protein: 2.0,
      carbs: 20.0,
      fat: 0.1,
      verified: true,
      source: 'seeded',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'Whole Eggs (Large)',
      normalizedName: 'whole eggs large',
      brand: 'Generic',
      category: 'Eggs',
      servingSize: 1,
      servingUnit: 'piece',
      calories: 72,
      protein: 6.0,
      carbs: 0.5,
      fat: 5.0,
      verified: true,
      source: 'seeded',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'Jasmine Rice (Cooked)',
      normalizedName: 'jasmine rice cooked',
      brand: 'Generic',
      category: 'Grain',
      servingSize: 100,
      servingUnit: 'g',
      calories: 130,
      protein: 2.7,
      carbs: 28.0,
      fat: 0.3,
      verified: true,
      source: 'seeded',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      name: 'Banana (Medium)',
      normalizedName: 'banana medium',
      brand: 'Generic',
      category: 'Fruit',
      servingSize: 1,
      servingUnit: 'piece',
      calories: 89,
      protein: 1.1,
      carbs: 22.8,
      fat: 0.3,
      verified: true,
      source: 'seeded',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  for (const item of seedItems) {
    const ref = doc(collection(db, 'foods'));
    batch.set(ref, { ...item, id: ref.id, searchTokens: buildSearchTokens(item.name, item.brand) });
  }

  await batch.commit();
}

/**
 * Find foods by name or brand, across the shared library and the user's own.
 *
 * Two passes per collection because Firestore can't do full-text search:
 *  · array-contains on searchTokens — matches a word anywhere in the name, so
 *    "milk" finds "Amul Taaza Milk";
 *  · the original prefix scan on normalizedName, kept so foods saved before
 *    tokens existed still turn up.
 *
 * Results are ranked so what you typed first appears first.
 */
export async function searchFoods(
  queryText: string,
  userId: string,
  max = 30,
): Promise<FoodProduct[]> {
  const clean = queryText.toLowerCase().trim();
  if (!clean) return [];

  const token = queryToken(clean);
  const end = clean + '\uf8ff';
  const foodsCol = collection(db, 'foods');
  const customCol = collection(db, 'users', userId, 'customFoods');

  const runs: Promise<FoodProduct[]>[] = [];
  const collect = (q: ReturnType<typeof query>, label: string) =>
    getDocs(q)
      .then((snap) => snap.docs.map((d) => d.data() as FoodProduct))
      .catch((err) => {
        // One failed pass shouldn't empty the results — but it must be visible,
        // or a broken query looks identical to "no matches".
        console.warn(`[searchFoods] ${label} query failed:`, err?.message ?? err);
        return [] as FoodProduct[];
      });

  if (token) {
    runs.push(collect(query(foodsCol, where('searchTokens', 'array-contains', token), limit(max)), 'foods/tokens'));
    runs.push(collect(query(customCol, where('searchTokens', 'array-contains', token), limit(max)), 'customFoods/tokens'));
  }
  runs.push(collect(query(foodsCol, where('normalizedName', '>=', clean), where('normalizedName', '<=', end), limit(max)), 'foods/prefix'));
  runs.push(collect(query(customCol, where('normalizedName', '>=', clean), where('normalizedName', '<=', end), limit(max)), 'customFoods/prefix'));

  const byId = new Map<string, FoodProduct>();
  for (const list of await Promise.all(runs)) {
    for (const food of list) if (!byId.has(food.id)) byId.set(food.id, food);
  }

  // Rank: name starts with the query, then name contains it, then the rest.
  // Within a tier, shorter names first — they're the plainer product.
  const score = (f: FoodProduct) => {
    const name = (f.normalizedName || f.name || '').toLowerCase();
    if (name.startsWith(clean)) return 0;
    if (name.includes(clean)) return 1;
    if ((f.brand || '').toLowerCase().includes(clean)) return 2;
    return 3;
  };
  return Array.from(byId.values())
    .sort((a, b) => score(a) - score(b) || (a.name?.length ?? 0) - (b.name?.length ?? 0))
    .slice(0, max);
}

// ─── User Custom Foods ────────────────────────────────────────────────────────

/** Create a custom food owned by the user. */
export async function createCustomFood(
  userId: string,
  food: Omit<FoodProduct, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'verified' | 'createdBy'>,
): Promise<string> {
  const ref = doc(collection(db, 'users', userId, 'customFoods'));
  const newFood: FoodProduct = {
    ...food,
    searchTokens: buildSearchTokens(food.name, food.brand),
    id: ref.id,
    source: 'custom',
    verified: false,
    createdBy: userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(ref, newFood);
  return ref.id;
}

/** Edit a custom food you created. Past log entries keep their snapshot. */
export async function updateCustomFood(
  userId: string,
  foodId: string,
  food: Partial<Omit<FoodProduct, 'id' | 'createdAt' | 'source' | 'createdBy'>>,
): Promise<void> {
  await setDoc(
    doc(db, 'users', userId, 'customFoods', foodId),
    {
      ...food,
      // Rebuild whenever the name or brand changes, or search goes stale.
      ...(food.name || food.brand ? { searchTokens: buildSearchTokens(food.name, food.brand) } : {}),
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

/** Delete a custom food. Anything already logged from it is unaffected. */
export async function deleteCustomFood(userId: string, foodId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'customFoods', foodId));
}

/** Get all user custom foods. */
export async function getCustomFoods(userId: string): Promise<FoodProduct[]> {
  const snap = await getDocs(collection(db, 'users', userId, 'customFoods'));
  return snap.docs.map((d) => d.data() as FoodProduct);
}

// ─── Recent & Frequent Foods ──────────────────────────────────────────────────

/** Get recently logged food entries from logs to suggest. */
export async function getRecentFoods(userId: string, max = 10): Promise<FoodProduct[]> {
  const q = query(
    collection(db, 'users', userId, 'foodLog'),
    orderBy('createdAt', 'desc'),
    limit(40), // fetch more to deduplicate and resolve
  );
  const snap = await getDocs(q);
  const logs = snap.docs.map((d) => d.data() as FoodLogEntry);

  const seenIds = new Set<string>();
  const results: FoodProduct[] = [];

  for (const log of logs) {
    if (log.foodId && !seenIds.has(log.foodId)) {
      seenIds.add(log.foodId);
      // Construct a food product representation from the log snapshot
      results.push({
        id: log.foodId,
        name: log.name,
        normalizedName: log.name.toLowerCase(),
        brand: log.brand,
        servingSize: log.quantity || 100,
        servingUnit: log.unit || 'g',
        calories: log.calories,
        protein: log.proteinG,
        carbs: log.carbsG,
        fat: log.fatG,
        fiber: log.fiberG,
        sugar: log.sugarG,
        sodium: log.sodiumMg,
        source: 'snapshot',
        verified: false,
        createdAt: log.createdAt,
        updatedAt: log.createdAt,
      });
      if (results.length >= max) break;
    }
  }

  return results;
}

/** Get frequent foods by counting logs frequency. */
export async function getFrequentFoods(userId: string, max = 5): Promise<FoodProduct[]> {
  const q = query(
    collection(db, 'users', userId, 'foodLog'),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  const logs = snap.docs.map((d) => d.data() as FoodLogEntry);

  const counts: Record<string, { count: number; log: FoodLogEntry }> = {};
  for (const log of logs) {
    if (!log.foodId) continue;
    if (!counts[log.foodId]) {
      counts[log.foodId] = { count: 0, log };
    }
    counts[log.foodId].count++;
  }

  const sorted = Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
    .map(({ log }) => ({
      id: log.foodId!,
      name: log.name,
      normalizedName: log.name.toLowerCase(),
      brand: log.brand,
      servingSize: log.quantity || 100,
      servingUnit: log.unit || 'g',
      calories: log.calories,
      protein: log.proteinG,
      carbs: log.carbsG,
      fat: log.fatG,
      fiber: log.fiberG,
      sugar: log.sugarG,
      sodium: log.sodiumMg,
      source: 'snapshot',
      verified: false,
      createdAt: log.createdAt,
      updatedAt: log.createdAt,
    }));

  return sorted;
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export async function toggleFavoriteFood(
  userId: string,
  food: FoodProduct,
  isFavorite: boolean,
): Promise<void> {
  const ref = doc(db, 'users', userId, 'favoriteFoods', food.id);
  if (isFavorite) {
    await setDoc(ref, food);
  } else {
    await deleteDoc(ref);
  }
}

export async function getFavoriteFoods(userId: string): Promise<FoodProduct[]> {
  const snap = await getDocs(collection(db, 'users', userId, 'favoriteFoods'));
  return snap.docs.map((d) => d.data() as FoodProduct);
}
