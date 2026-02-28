// ── Types ──────────────────────────────────────────────────────────

export interface MacroTarget {
  current: number;
  target: number;
  unit: string;
}

export interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Meal {
  name: string;
  totalCalories: number;
  items: FoodItem[];
}

export interface DailyNutrition {
  calories: MacroTarget;
  protein: MacroTarget;
  carbs: MacroTarget;
  fat: MacroTarget;
  fiber: MacroTarget;
  sodium: MacroTarget;
  potassium: MacroTarget;
  meals: Meal[];
}

export interface ExerciseSet {
  reps: number;
  weight: number;
}

export interface Exercise {
  name: string;
  sets: ExerciseSet[];
}

export interface CardioData {
  duration: number;
  distance?: number;
  heartRate?: number;
  caloriesBurned: number;
}

export type WorkoutType = "strength" | "cardio" | "rest";
export type WorkoutStatus = "completed" | "scheduled" | "rest";

export interface WorkoutSession {
  name: string;
  type: WorkoutType;
  status: WorkoutStatus;
  exercises?: Exercise[];
  cardio?: CardioData;
}

export interface WorkoutPlanExercise {
  id: number;
  exerciseName: string;
  targetSets: { reps: number; weight: number }[] | null;
  durationMin: number | null;
  distance: number | null;
  notes: string | null;
}

export interface WorkoutPlan {
  workoutName: string;
  workoutType: WorkoutType;
  exercises: WorkoutPlanExercise[];
}

export interface WeekDay {
  date: string;
  label: string;
  status: "completed" | "scheduled" | "rest";
}

export interface BodyReading {
  date: string;
  weight: number;
  bodyFat: number;
  leanMass: number;
  bmi: number;
  bodyWater: number;
}

export interface WeightTrendPoint {
  date: string;
  weight: number;
}

export interface MealPlanSlot {
  id: number;
  timeSlot: string;
  timeLabel: string;
  mealLabel: string;
  source: string;
  itemName: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sodium: number | null;
  potassium: number | null;
  notes: string | null;
}

export interface DailyMealPlan {
  entries: MealPlanSlot[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSodium: number;
  totalPotassium: number;
}

export interface PantryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  caloriesPerServing: number | null;
  proteinPerServing: number | null;
  carbsPerServing: number | null;
  fatPerServing: number | null;
  servingSize: string | null;
}

export interface FitnessDay {
  date: Date;
  nutrition: DailyNutrition;
  workout: WorkoutSession;
  body: {
    latest: BodyReading;
    weightDelta: number;
    bodyFatDelta: number;
    goalWeight: number;
    trend: WeightTrendPoint[];
    recentReadings: BodyReading[];
  };
  weekOverview: WeekDay[];
  workoutPlan: WorkoutPlan | null;
  mealPlan: DailyMealPlan | null;
  pantryItems: PantryItem[];
}

