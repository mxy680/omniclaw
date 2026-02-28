import { getNutritionDb } from "../plugin.js";
import type { WsClientMessage, WsFitnessDay } from "./types.js";
import type { WsServerInstance } from "./ws-server.js";

export function handleFitnessMessage(
  connId: string,
  msg: WsClientMessage & { type: "fitness_day" },
  wsServer: WsServerInstance,
): void {
  const db = getNutritionDb();
  if (!db) {
    wsServer.send(connId, { type: "error", message: "Nutrition database not available" });
    return;
  }

  const date = msg.date; // YYYY-MM-DD

  // Food entries for the requested date
  const foodEntries = db.getFoodEntries(date, date).entries;

  // Active macro targets
  const targets = db.getActiveTargets();

  // Exercises for the requested date
  const exercises = db.getExercises(date, date);

  // Biometrics for the requested date
  const biometrics = db.getBiometrics(date, date);

  // Meal plan for the requested date
  const mealPlanEntries = db.getMealPlan(date);

  // Pantry inventory
  const pantryItems = db.listPantryItems();

  // Workout plan for the requested date
  const workoutPlanEntries = db.getWorkoutPlan(date);

  // 30-day weight trend
  const trendEnd = date;
  const trendStart = offsetDate(date, -30);
  const weightBiometrics = db.getBiometrics(trendStart, trendEnd, "weight");
  const weight_trend = weightBiometrics.map((b) => ({ date: b.date, value: b.value }));

  // Week exercises (Mon–Sun of the week containing `date`)
  const { monday, sunday } = getWeekBounds(date);
  const weekExercises = db.getExercises(monday, sunday);
  const seenDates = new Set<string>();
  const week_exercises: Array<{ date: string }> = [];
  for (const ex of weekExercises) {
    if (!seenDates.has(ex.date)) {
      seenDates.add(ex.date);
      week_exercises.push({ date: ex.date });
    }
  }

  // Week workout plans (dates with plans in the current week)
  const weekPlans = db.getWorkoutPlanRange(monday, sunday);
  const planDates = new Set<string>();
  for (const p of weekPlans) {
    planDates.add(p.date);
  }
  const week_workout_plans: Array<{ date: string }> = Array.from(planDates).map((d) => ({ date: d }));

  const data: WsFitnessDay = {
    date,
    food_entries: foodEntries.map((e) => ({
      id: e.id,
      meal: e.meal ?? null,
      food_name: e.food_name,
      serving: e.serving ?? null,
      calories: e.calories,
      protein_g: e.protein_g,
      carbs_g: e.carbs_g,
      fat_g: e.fat_g,
      fiber_g: e.fiber_g ?? null,
      sodium_mg: e.sodium_mg ?? null,
    })),
    daily_totals: mealPlanEntries.length > 0
      ? {
          calories: mealPlanEntries.reduce((s, e) => s + (e.calories ?? 0), 0),
          protein_g: mealPlanEntries.reduce((s, e) => s + (e.protein_g ?? 0), 0),
          carbs_g: mealPlanEntries.reduce((s, e) => s + (e.carbs_g ?? 0), 0),
          fat_g: mealPlanEntries.reduce((s, e) => s + (e.fat_g ?? 0), 0),
          fiber_g: mealPlanEntries.reduce((s, e) => s + (e.fiber_g ?? 0), 0),
          sodium_mg: mealPlanEntries.reduce((s, e) => s + (e.sodium_mg ?? 0), 0),
          potassium_mg: mealPlanEntries.reduce((s, e) => s + (e.potassium_mg ?? 0), 0),
        }
      : null,
    targets,
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.name,
      exercise_type: e.exercise_type ?? null,
      duration_min: e.duration_min ?? null,
      calories_burned: e.calories_burned ?? null,
      details: e.details ?? null,
    })),
    biometrics: biometrics.map((b) => ({
      metric: b.metric,
      value: b.value,
      unit: b.unit,
      date: b.date,
    })),
    weight_trend,
    week_exercises,
    meal_plan: mealPlanEntries.map((e) => ({
      id: e.id,
      time_slot: e.time_slot,
      meal_label: e.meal_label,
      source: e.source,
      source_id: e.source_id ?? null,
      item_name: e.item_name,
      calories: e.calories ?? null,
      protein_g: e.protein_g ?? null,
      carbs_g: e.carbs_g ?? null,
      fat_g: e.fat_g ?? null,
      fiber_g: e.fiber_g ?? null,
      sodium_mg: e.sodium_mg ?? null,
      potassium_mg: e.potassium_mg ?? null,
      notes: e.notes ?? null,
    })),
    pantry_items: pantryItems.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      quantity: p.quantity,
      unit: p.unit,
      calories_per_serving: p.calories_per_serving ?? null,
      protein_g_per_serving: p.protein_g_per_serving ?? null,
      carbs_g_per_serving: p.carbs_g_per_serving ?? null,
      fat_g_per_serving: p.fat_g_per_serving ?? null,
      serving_size: p.serving_size ?? null,
    })),
    workout_plan: workoutPlanEntries.length > 0
      ? {
          workout_name: workoutPlanEntries[0].workout_name,
          workout_type: workoutPlanEntries[0].workout_type,
          exercises: workoutPlanEntries.map((e) => ({
            id: e.id,
            exercise_order: e.exercise_order,
            exercise_name: e.exercise_name,
            target_sets: e.target_sets ?? null,
            duration_min: e.duration_min ?? null,
            distance: e.distance ?? null,
            notes: e.notes ?? null,
          })),
        }
      : null,
    week_workout_plans,
  };

  wsServer.send(connId, { type: "fitness_day", data });
}

// ── Helpers ─────────────────────────────────────────────────────────

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getWeekBounds(dateStr: string): { monday: string; sunday: string } {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    monday: mon.toISOString().slice(0, 10),
    sunday: sun.toISOString().slice(0, 10),
  };
}
