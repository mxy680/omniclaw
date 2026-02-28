import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionSaveMealPlanTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_save_meal_plan",
    label: "Save Meal Plan",
    description:
      "Save a daily meal plan with scheduled time slots. Replaces any existing plan for the date. Optionally deducts pantry quantities for pantry-sourced items.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({ description: "Date in YYYY-MM-DD format. Defaults to today." }),
      ),
      entries: Type.Array(
        Type.Object({
          time_slot: Type.String({ description: 'Scheduled time, e.g. "08:00", "12:30", "18:00"' }),
          meal_label: Type.String({
            description: "Meal category: Breakfast, Lunch, Dinner, Snack, etc.",
          }),
          source: Type.String({ description: '"factor75" or "pantry"' }),
          source_id: Type.Optional(
            Type.String({ description: "ID reference to source item (Factor75 meal ID or pantry item ID)" }),
          ),
          item_name: Type.String({ description: "Display name of the food item" }),
          calories: Type.Optional(Type.Number({ description: "Calories" })),
          protein_g: Type.Optional(Type.Number({ description: "Protein in grams" })),
          carbs_g: Type.Optional(Type.Number({ description: "Carbs in grams" })),
          fat_g: Type.Optional(Type.Number({ description: "Fat in grams" })),
          fiber_g: Type.Optional(Type.Number({ description: "Fiber in grams" })),
          sodium_mg: Type.Optional(Type.Number({ description: "Sodium in milligrams" })),
          potassium_mg: Type.Optional(Type.Number({ description: "Potassium in milligrams" })),
          notes: Type.Optional(Type.String({ description: "Notes" })),
        }),
        { description: "Array of meal plan entries for the day" },
      ),
      deduct_pantry: Type.Optional(
        Type.Boolean({
          description:
            "If true, deduct 1 from pantry quantity for each pantry-sourced entry. Default false.",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        date?: string;
        entries: Array<{
          time_slot: string;
          meal_label: string;
          source: string;
          source_id?: string;
          item_name: string;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          fiber_g?: number;
          sodium_mg?: number;
          potassium_mg?: number;
          notes?: string;
        }>;
        deduct_pantry?: boolean;
      },
    ) {
      try {
        const date = params.date ?? todayStr();
        const entries = db.saveMealPlan(
          date,
          params.entries.map((e) => ({ ...e, date })),
        );

        if (params.deduct_pantry) {
          for (const e of params.entries) {
            if (e.source === "pantry" && e.source_id) {
              db.deductPantryQuantity(Number(e.source_id), 1);
            }
          }
        }

        const totals = {
          calories: entries.reduce((s, e) => s + (e.calories ?? 0), 0),
          protein_g: entries.reduce((s, e) => s + (e.protein_g ?? 0), 0),
          carbs_g: entries.reduce((s, e) => s + (e.carbs_g ?? 0), 0),
          fat_g: entries.reduce((s, e) => s + (e.fat_g ?? 0), 0),
          fiber_g: entries.reduce((s, e) => s + (e.fiber_g ?? 0), 0),
          sodium_mg: entries.reduce((s, e) => s + (e.sodium_mg ?? 0), 0),
          potassium_mg: entries.reduce((s, e) => s + (e.potassium_mg ?? 0), 0),
        };

        const targets = db.getActiveTargets();

        return jsonResult({ date, entries, totals, targets });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
