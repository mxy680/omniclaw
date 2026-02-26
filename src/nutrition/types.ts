export interface FoodEntryInput {
  date: string;
  meal?: string;
  food_name: string;
  serving?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  notes?: string;
}

export interface FoodEntry extends FoodEntryInput {
  id: number;
  created_at: string;
}

export interface DailyTotal {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  entry_count: number;
}

export interface ExerciseInput {
  date: string;
  name: string;
  exercise_type?: string;
  duration_min?: number;
  calories_burned?: number;
  details?: Record<string, unknown>;
  notes?: string;
}

export interface ExerciseEntry extends ExerciseInput {
  id: number;
  created_at: string;
}

export interface BiometricInput {
  date: string;
  metric: string;
  value: number;
  unit: string;
  notes?: string;
}

export interface BiometricEntry extends BiometricInput {
  id: number;
  created_at: string;
}

export interface NoteEntry {
  id: number;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NutritionTargets {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sodium_mg?: number;
}

export interface PantryItemInput {
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  calories_per_serving?: number;
  protein_g_per_serving?: number;
  carbs_g_per_serving?: number;
  fat_g_per_serving?: number;
  serving_size?: string;
  notes?: string;
}

export interface PantryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  calories_per_serving: number | null;
  protein_g_per_serving: number | null;
  carbs_g_per_serving: number | null;
  fat_g_per_serving: number | null;
  serving_size: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealPlanEntryInput {
  date: string;
  time_slot: string;
  meal_label: string;
  source: string;
  source_id?: string;
  item_name: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  notes?: string;
}

export interface MealPlanEntry {
  id: number;
  date: string;
  time_slot: string;
  meal_label: string;
  source: string;
  source_id: string | null;
  item_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  created_at: string;
}
