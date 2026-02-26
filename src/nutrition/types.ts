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
