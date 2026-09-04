/**
 * Barcode → food lookup.
 * Owner: jaikanth (backend).
 *
 * Our own `foods` collection is checked first; anything unknown is looked up in
 * Open Food Facts, which is free, needs no API key, and covers ~3M packaged
 * products worldwide including Indian brands.
 *
 * OFF data is crowdsourced, so treat what comes back as a starting point the
 * user can correct — it's returned unverified and saved as one of their own
 * foods, never written into the shared library.
 */
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import type { FoodProduct } from '../../models/index';
import { db } from '../../config/firebase';

const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
/** Only the fields we map, so we're not pulling a 50KB document per scan. */
const OFF_FIELDS = [
  'product_name',
  'brands',
  'serving_quantity',
  'quantity',
  'nutriments',
  'image_front_small_url',
  'categories',
].join(',');

export type BarcodeResult =
  | { status: 'found'; food: FoodProduct; source: 'library' | 'openfoodfacts' }
  | { status: 'not_found' }
  | { status: 'error' };

/** A number that might arrive as a string, or not at all. */
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};

/** Look a barcode up in our library, then in Open Food Facts. */
export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  const code = barcode.trim();
  if (!code) return { status: 'not_found' };

  // 1. Ours first — instant, and it keeps any corrections we've made.
  try {
    const snap = await getDocs(
      query(collection(db, 'foods'), where('barcode', '==', code), limit(1)),
    );
    if (!snap.empty) {
      return { status: 'found', food: snap.docs[0].data() as FoodProduct, source: 'library' };
    }
  } catch {
    // A failed library read shouldn't stop the online lookup.
  }

  // 2. Open Food Facts.
  try {
    const res = await fetch(`${OFF_ENDPOINT}/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, {
      headers: { 'User-Agent': 'IronSync/1.0 (github.com/jayakanthh/IronSync)' },
    });
    if (!res.ok) return res.status === 404 ? { status: 'not_found' } : { status: 'error' };

    const json = await res.json();
    const p = json?.product;
    if (!p || json.status === 0) return { status: 'not_found' };

    const n = p.nutriments ?? {};
    // OFF stores per-100g values under the _100g suffix; that's our serving base.
    const food: FoodProduct = {
      id: `off_${code}`,
      name: p.product_name?.trim() || `Product ${code}`,
      normalizedName: (p.product_name || `product ${code}`).toLowerCase().trim(),
      brand: p.brands?.split(',')[0]?.trim() || undefined,
      category: p.categories?.split(',')[0]?.trim() || undefined,
      servingSize: 100,
      servingUnit: 'g',
      calories: num(n['energy-kcal_100g']),
      protein: num(n.proteins_100g),
      carbs: num(n.carbohydrates_100g),
      fat: num(n.fat_100g),
      fiber: n.fiber_100g != null ? num(n.fiber_100g) : undefined,
      sugar: n.sugars_100g != null ? num(n.sugars_100g) : undefined,
      // OFF reports sodium in grams; we store milligrams.
      sodium: n.sodium_100g != null ? Math.round(num(n.sodium_100g) * 1000) : undefined,
      barcode: code,
      image: p.image_front_small_url || undefined,
      source: 'openfoodfacts',
      verified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // A product with no energy value is no use to log against.
    if (!food.calories && !food.protein && !food.carbs && !food.fat) return { status: 'not_found' };

    return { status: 'found', food, source: 'openfoodfacts' };
  } catch {
    return { status: 'error' };
  }
}
