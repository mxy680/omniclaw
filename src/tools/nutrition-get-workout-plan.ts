import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import type { WorkoutPlanEntry } from "../nutrition/types.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionGetWorkoutPlanTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_get_workout_plan",
    label: "Get Workout Plan",
    description:
      "Retrieve saved workout plans. Returns a single day by default, or a date range if 'end' is provided.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({ description: "Start date in YYYY-MM-DD format. Defaults to today." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date for range query. If omitted, returns single day." }),
      ),
    }),
    async execute(_toolCallId: string, params: { date?: string; end?: string }) {
      try {
        const date = params.date ?? todayStr();
        const entries = params.end
          ? db.getWorkoutPlanRange(date, params.end)
          : db.getWorkoutPlan(date);

        // Group by date
        const byDate = new Map<string, WorkoutPlanEntry[]>();
        for (const e of entries) {
          const arr = byDate.get(e.date) ?? [];
          arr.push(e);
          byDate.set(e.date, arr);
        }

        const plans = Array.from(byDate.entries()).map(([d, dayEntries]) => {
          // All entries for a day share the same workout_name and workout_type
          const { workout_name, workout_type } = dayEntries[0];
          return {
            date: d,
            workout_name,
            workout_type,
            exercises: dayEntries.map((e) => ({
              exercise_name: e.exercise_name,
              target_sets: e.target_sets,
              duration_min: e.duration_min,
              distance: e.distance,
              notes: e.notes,
            })),
          };
        });

        return jsonResult({ plans });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
