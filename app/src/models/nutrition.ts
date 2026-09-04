/** Daily calorie & macro targets derived from the user's goal. */
export interface NutritionTargets {
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface FoodProduct {
  id: string;
  name: string;
  normalizedName: string;
  brand?: string;
  category?: string;
  servingSize: number;
  servingUnit: string; // 'g' | 'ml' | 'piece' | 'serving'
  calories: number; // per servingSize
  protein: number; // per servingSize
  carbs: number; // per servingSize
  fat: number; // per servingSize
  fiber?: number;
  sugar?: number;
  sodium?: number;
  barcode?: string;
  image?: string;
  /** Words and word-prefixes of the name/brand — how search finds this food.
   *  Built by buildSearchTokens(); absent on anything saved before it existed. */
  searchTokens?: string[];
  source: string; // 'seeded' | 'custom'
  verified: boolean;
  createdBy?: string; // userId if custom
  createdAt: number;
  updatedAt: number;
}

/** One logged food entry with historical snapshot. */
export interface FoodLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  meal?: Meal; // breakfast, lunch, dinner, snacks
  name: string;
  calories: number; // scaled to quantity
  proteinG: number; // scaled to quantity
  carbsG: number; // scaled to quantity
  fatG: number; // scaled to quantity
  
  // Historical Snapshot fields
  foodId?: string;
  brand?: string;
  quantity?: number; // e.g. 200 (ml)
  unit?: string; // e.g. 'ml'
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  
  createdAt: number;
}

/** One food inside a saved meal — the loggable half of a FoodLogEntry. */
export interface SavedMealItem {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  foodId?: string;
  brand?: string;
  quantity?: number;
  unit?: string;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
}

/**
 * A meal you've saved to re-log in one tap ("my usual breakfast").
 * Foods are snapshotted, so editing the source food later won't rewrite history.
 */
export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
  createdAt: number;
}

/** How much water you're aiming for, and the size of one tap. */
export interface WaterPrefs {
  targetMl: number;
  incrementMl: number;
}

/** A day's water intake, in millilitres. */
export interface WaterLog {
  date: string; // YYYY-MM-DD
  ml: number;
  updatedAt: number;
}

export interface UserFavoriteFood {
  userId: string;
  foodId: string;
  isCustom: boolean;
  createdAt: number;
}
