import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import type { MealPlanEntry } from "../nutrition/types.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionGetMealPlanTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_get_meal_plan",
    label: "Get Meal Plan",
    description:
      "Retrieve saved meal plans. Returns a single day by default, or a date range if 'end' is provided.",
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
          ? db.getMealPlanRange(date, params.end)
          : db.getMealPlan(date);

        // Group by date for daily totals
        const byDate = new Map<string, MealPlanEntry[]>();
        for (const e of entries) {
          const arr = byDate.get(e.date) ?? [];
          arr.push(e);
          byDate.set(e.date, arr);
        }

        const plans = Array.from(byDate.entries()).map(([d, dayEntries]) => ({
          date: d,
          entries: dayEntries,
          totals: {
            calories: dayEntries.reduce((s, e) => s + (e.calories ?? 0), 0),
            protein_g: dayEntries.reduce((s, e) => s + (e.protein_g ?? 0), 0),
            carbs_g: dayEntries.reduce((s, e) => s + (e.carbs_g ?? 0), 0),
            fat_g: dayEntries.reduce((s, e) => s + (e.fat_g ?? 0), 0),
          },
        }));

        const targets = db.getActiveTargets();

        return jsonResult({ plans, targets });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
