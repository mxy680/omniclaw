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

  // Food entries + daily totals for the requested date
  const { entries, daily_totals } = db.getFoodEntries(date, date);

  // Active macro targets
  const targets = db.getActiveTargets();

  // Exercises for the requested date
  const exercises = db.getExercises(date, date);

  // Biometrics for the requested date
  const biometrics = db.getBiometrics(date, date);

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

  const totalsForDate = daily_totals.find((t) => t.date === date) ?? null;

  const data: WsFitnessDay = {
    date,
    food_entries: entries.map((e) => ({
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
    daily_totals: totalsForDate
      ? {
          calories: totalsForDate.calories,
          protein_g: totalsForDate.protein_g,
          carbs_g: totalsForDate.carbs_g,
          fat_g: totalsForDate.fat_g,
          fiber_g: totalsForDate.fiber_g,
          sodium_mg: totalsForDate.sodium_mg,
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
