import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionDeleteMealPlanTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_delete_meal_plan",
    label: "Delete Meal Plan",
    description: "Delete the meal plan for a specific date.",
    parameters: Type.Object({
      date: Type.String({ description: "Date in YYYY-MM-DD format" }),
    }),
    async execute(_toolCallId: string, params: { date: string }) {
      try {
        const deleted_count = db.deleteMealPlan(params.date);
        return jsonResult({
          deleted_count,
          message: deleted_count > 0
            ? `Deleted ${deleted_count} meal plan entries for ${params.date}`
            : `No meal plan found for ${params.date}`,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
