import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionLogFoodTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_log_food",
    label: "Log Food",
    description:
      "Log one or more food entries to the nutrition diary. Returns the inserted entries, daily totals for that date, and active macro targets.",
    parameters: Type.Object({
      entries: Type.Array(
        Type.Object({
          food_name: Type.String({ description: "Name of the food item" }),
          calories: Type.Number({ description: "Calories (kcal)" }),
          protein_g: Type.Number({ description: "Protein in grams" }),
          carbs_g: Type.Number({ description: "Carbohydrates in grams" }),
          fat_g: Type.Number({ description: "Fat in grams" }),
          serving: Type.Optional(Type.String({ description: 'Serving size, e.g. "1 cup", "200g"' })),
          fiber_g: Type.Optional(Type.Number({ description: "Fiber in grams" })),
          sugar_g: Type.Optional(Type.Number({ description: "Sugar in grams" })),
          sodium_mg: Type.Optional(Type.Number({ description: "Sodium in milligrams" })),
          notes: Type.Optional(Type.String({ description: "Notes about this food entry" })),
        }),
        { description: "Array of food items to log" },
      ),
      meal: Type.Optional(
        Type.String({
          description: "Meal category: breakfast, lunch, dinner, snack, or other. Defaults to 'other'.",
        }),
      ),
      date: Type.Optional(
        Type.String({ description: "Date in YYYY-MM-DD format. Defaults to today." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        entries: Array<{
          food_name: string;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          serving?: string;
          fiber_g?: number;
          sugar_g?: number;
          sodium_mg?: number;
          notes?: string;
        }>;
        meal?: string;
        date?: string;
      },
    ) {
      try {
        const date = params.date ?? todayStr();
        const meal = params.meal ?? "other";

        const inputs = params.entries.map((e) => ({
          ...e,
          date,
          meal,
        }));

        const inserted = db.addFoodEntries(inputs);
        const { daily_totals } = db.getFoodEntries(date, date);
        const targets = db.getActiveTargets();

        return jsonResult({ logged: inserted, daily_totals, targets });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
