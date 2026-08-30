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

export interface UserFavoriteFood {
  userId: string;
  foodId: string;
  isCustom: boolean;
  createdAt: number;
}
