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
import type { FoodLogEntry, NutritionTargets, FoodProduct } from '../../models/index';
import { db } from '../../config/firebase';

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

// ─── Food Database & Search ──────────────────────────────────────────────────

/** Seed initial realistic foods if the foods collection is completely empty. */
export async function seedFoodDatabase(): Promise<void> {
  const checkQ = query(collection(db, 'foods'), limit(1));
  const checkSnap = await getDocs(checkQ);
  if (!checkSnap.empty) return; // already seeded

  const batch = writeBatch(db);
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
    batch.set(ref, { ...item, id: ref.id });
  }

  await batch.commit();
}

/** Search global food database + user custom foods. */
export async function searchFoods(
  queryText: string,
  userId: string,
  max = 30,
): Promise<FoodProduct[]> {
  const clean = queryText.toLowerCase().trim();
  if (!clean) return [];

  // Prefix query for search
  const end = clean + '\uf8ff';

  // 1. Search global foods by normalized name prefix
  const globalQ = query(
    collection(db, 'foods'),
    where('normalizedName', '>=', clean),
    where('normalizedName', '<=', end),
    limit(max),
  );
  const globalSnap = await getDocs(globalQ);
  const globalResults = globalSnap.docs.map((d) => d.data() as FoodProduct);

  // 2. Search user custom foods by normalized name prefix
  const customQ = query(
    collection(db, 'users', userId, 'customFoods'),
    where('normalizedName', '>=', clean),
    where('normalizedName', '<=', end),
    limit(max),
  );
  const customSnap = await getDocs(customQ);
  const customResults = customSnap.docs.map((d) => d.data() as FoodProduct);

  // Merge and limit
  const merged = [...globalResults, ...customResults];
  return merged.slice(0, max);
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
