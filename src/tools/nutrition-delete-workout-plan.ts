import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionDeleteWorkoutPlanTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_delete_workout_plan",
    label: "Delete Workout Plan",
    description: "Delete the workout plan for a specific date.",
    parameters: Type.Object({
      date: Type.String({ description: "Date in YYYY-MM-DD format" }),
    }),
    async execute(_toolCallId: string, params: { date: string }) {
      try {
        const deleted_count = db.deleteWorkoutPlan(params.date);
        return jsonResult({
          deleted_count,
          message:
            deleted_count > 0
              ? `Deleted ${deleted_count} workout plan entries for ${params.date}`
              : `No workout plan found for ${params.date}`,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
