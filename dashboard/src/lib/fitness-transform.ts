import type { WsFitnessDay } from "./websocket";
import type {
  FitnessDay,
  DailyNutrition,
  DailyMealPlan,
  PantryItem,
  MacroTarget,
  WorkoutSession,
  WorkoutPlan,
  WorkoutType,
  WeekDay,
  BodyReading,
  WeightTrendPoint,
} from "./fitness-data";

// ── Default targets ─────────────────────────────────────────────────

const DEFAULT_TARGETS = {
  calories: 2000,
  protein_g: 150,
  carbs_g: 250,
  fat_g: 65,
  fiber_g: 30,
  sodium_mg: 2300,
  potassium_mg: 4700,
};

// ── Main transform ──────────────────────────────────────────────────

export function transformFitnessDay(ws: WsFitnessDay): FitnessDay {
  const date = new Date(ws.date + "T00:00:00");

  return {
    date,
    nutrition: buildNutrition(ws),
    workout: buildWorkout(ws),
    body: buildBody(ws),
    weekOverview: buildWeekOverview(ws, date),
    workoutPlan: buildWorkoutPlan(ws),
    mealPlan: buildMealPlan(ws),
    pantryItems: buildPantryItems(ws),
  };
}

// ── Nutrition ───────────────────────────────────────────────────────

function buildNutrition(ws: WsFitnessDay): DailyNutrition {
  const t = ws.daily_totals;
  const tgt = ws.targets;

  function macro(
    current: number,
    targetVal: number | undefined,
    fallback: number,
    unit: string,
  ): MacroTarget {
    return { current, target: targetVal ?? fallback, unit };
  }

  return {
    calories: macro(t?.calories ?? 0, tgt?.calories, DEFAULT_TARGETS.calories, "kcal"),
    protein: macro(t?.protein_g ?? 0, tgt?.protein_g, DEFAULT_TARGETS.protein_g, "g"),
    carbs: macro(t?.carbs_g ?? 0, tgt?.carbs_g, DEFAULT_TARGETS.carbs_g, "g"),
    fat: macro(t?.fat_g ?? 0, tgt?.fat_g, DEFAULT_TARGETS.fat_g, "g"),
    fiber: macro(t?.fiber_g ?? 0, tgt?.fiber_g, DEFAULT_TARGETS.fiber_g, "g"),
    sodium: macro(t?.sodium_mg ?? 0, tgt?.sodium_mg, DEFAULT_TARGETS.sodium_mg, "mg"),
    potassium: macro(t?.potassium_mg ?? 0, tgt?.potassium_mg, DEFAULT_TARGETS.potassium_mg, "mg"),
    meals: [],
  };
}

// ── Workout ─────────────────────────────────────────────────────────

function buildWorkout(ws: WsFitnessDay): WorkoutSession {
  const plan = ws.workout_plan;
  if (!plan || plan.workout_type === "rest") {
    return { name: "Rest Day", type: "rest", status: "rest" };
  }

  if (plan.workout_type === "strength") {
    return {
      name: plan.workout_name,
      type: "strength",
      status: "scheduled",
      exercises: plan.exercises.map((e) => ({
        name: e.exercise_name,
        sets: e.target_sets ?? [],
      })),
    };
  }

  if (plan.workout_type === "cardio") {
    const totalDuration = plan.exercises.reduce((s, e) => s + (e.duration_min ?? 0), 0);
    return {
      name: plan.workout_name,
      type: "cardio",
      status: "scheduled",
      cardio: {
        duration: totalDuration,
        caloriesBurned: 0,
      },
    };
  }

  return { name: "Rest Day", type: "rest", status: "rest" };
}

// ── Body ────────────────────────────────────────────────────────────

function buildBody(ws: WsFitnessDay): FitnessDay["body"] {
  // Extract weight and body_fat from biometrics
  const weightReading = ws.biometrics.find((b) => b.metric === "weight");
  const bodyFatReading = ws.biometrics.find((b) => b.metric === "body_fat");

  const weight = weightReading?.value ?? 0;
  const bodyFat = bodyFatReading?.value ?? 0;
  const heightM = 1.78; // default height for BMI calc

  const latest: BodyReading = {
    date: fmtDate(ws.date),
    weight: round1(weight),
    bodyFat: round1(bodyFat),
    leanMass: weight > 0 ? round1(weight * (1 - bodyFat / 100)) : 0,
    bmi: weight > 0 ? round1(weight / 2.205 / (heightM * heightM)) : 0,
    bodyWater: 0,
  };

  // Weight trend from DB data
  const trend: WeightTrendPoint[] = ws.weight_trend.map((p) => ({
    date: fmtDate(p.date),
    weight: round1(p.value),
  }));

  // Compute delta from trend
  const prevWeight =
    trend.length > 1 ? trend[trend.length - 2].weight : latest.weight;
  const weightDelta = round1(latest.weight - prevWeight);

  // Recent readings — pick unique dates from biometrics (up to 6)
  const bioDates = new Set<string>();
  const recentReadings: BodyReading[] = [];
  for (const b of ws.biometrics) {
    if (bioDates.size >= 6) break;
    if (bioDates.has(b.date)) continue;
    bioDates.add(b.date);
    const w = ws.biometrics.find((x) => x.metric === "weight" && x.date === b.date)?.value ?? 0;
    const bf = ws.biometrics.find((x) => x.metric === "body_fat" && x.date === b.date)?.value ?? 0;
    recentReadings.push({
      date: fmtDate(b.date),
      weight: round1(w),
      bodyFat: round1(bf),
      leanMass: w > 0 ? round1(w * (1 - bf / 100)) : 0,
      bmi: w > 0 ? round1(w / 2.205 / (heightM * heightM)) : 0,
      bodyWater: 0,
    });
  }

  return {
    latest,
    weightDelta,
    bodyFatDelta: 0,
    goalWeight: 175,
    trend,
    recentReadings,
  };
}

// ── Week Overview ───────────────────────────────────────────────────

function buildWeekOverview(ws: WsFitnessDay, date: Date): WeekDay[] {
  const monday = new Date(date);
  const day = monday.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diffToMon);

  const planDates = new Set(
    (ws.week_workout_plans ?? []).map((p) => p.date),
  );
  const labels = ["M", "T", "W", "T", "F", "S", "S"];

  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    const status: "scheduled" | "rest" = planDates.has(dateStr) ? "scheduled" : "rest";
    return { date: fmtDate(dateStr), label, status };
  });
}

// ── Meal Plan ────────────────────────────────────────────────────────

function buildMealPlan(ws: WsFitnessDay): DailyMealPlan | null {
  if (!ws.meal_plan || ws.meal_plan.length === 0) return null;

  const sorted = [...ws.meal_plan].sort((a, b) =>
    a.time_slot.localeCompare(b.time_slot),
  );

  const entries = sorted.map((e) => ({
    id: e.id,
    timeSlot: e.time_slot,
    timeLabel: fmtTime(e.time_slot),
    mealLabel: e.meal_label,
    source: e.source,
    itemName: e.item_name,
    calories: e.calories,
    protein: e.protein_g,
    carbs: e.carbs_g,
    fat: e.fat_g,
    fiber: e.fiber_g,
    sodium: e.sodium_mg,
    potassium: e.potassium_mg,
    notes: e.notes,
  }));

  return {
    entries,
    totalCalories: entries.reduce((s, e) => s + (e.calories ?? 0), 0),
    totalProtein: entries.reduce((s, e) => s + (e.protein ?? 0), 0),
    totalCarbs: entries.reduce((s, e) => s + (e.carbs ?? 0), 0),
    totalFat: entries.reduce((s, e) => s + (e.fat ?? 0), 0),
    totalFiber: entries.reduce((s, e) => s + (e.fiber ?? 0), 0),
    totalSodium: entries.reduce((s, e) => s + (e.sodium ?? 0), 0),
    totalPotassium: entries.reduce((s, e) => s + (e.potassium ?? 0), 0),
  };
}

// ── Pantry ──────────────────────────────────────────────────────────

function buildPantryItems(ws: WsFitnessDay): PantryItem[] {
  if (!ws.pantry_items) return [];
  return ws.pantry_items.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    quantity: p.quantity,
    unit: p.unit,
    caloriesPerServing: p.calories_per_serving,
    proteinPerServing: p.protein_g_per_serving,
    carbsPerServing: p.carbs_g_per_serving,
    fatPerServing: p.fat_g_per_serving,
    servingSize: p.serving_size,
  }));
}

// ── Workout Plan ──────────────────────────────────────────────────

function buildWorkoutPlan(ws: WsFitnessDay): WorkoutPlan | null {
  if (!ws.workout_plan) return null;

  return {
    workoutName: ws.workout_plan.workout_name,
    workoutType: ws.workout_plan.workout_type as WorkoutType,
    exercises: ws.workout_plan.exercises.map((e) => ({
      id: e.id,
      exerciseName: e.exercise_name,
      targetSets: e.target_sets,
      durationMin: e.duration_min,
      distance: e.distance,
      notes: e.notes,
    })),
  };
}

function fmtTime(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
}

// ── Helpers ─────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
