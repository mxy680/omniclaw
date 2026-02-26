import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionAddPantryItemTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_add_pantry_item",
    label: "Add Pantry Item",
    description:
      "Add an item to the pantry inventory. Track what foods are available at home for meal planning.",
    parameters: Type.Object({
      name: Type.String({ description: "Name of the pantry item" }),
      category: Type.Optional(
        Type.String({
          description:
            "Category: snack, protein, dairy, grain, fruit, vegetable, condiment, or other",
        }),
      ),
      quantity: Type.Optional(Type.Number({ description: "Quantity on hand (default 1)" })),
      unit: Type.Optional(
        Type.String({ description: 'Unit of measure: item, lb, bag, box, etc. (default "item")' }),
      ),
      calories_per_serving: Type.Optional(Type.Number({ description: "Calories per serving" })),
      protein_g_per_serving: Type.Optional(Type.Number({ description: "Protein (g) per serving" })),
      carbs_g_per_serving: Type.Optional(
        Type.Number({ description: "Carbohydrates (g) per serving" }),
      ),
      fat_g_per_serving: Type.Optional(Type.Number({ description: "Fat (g) per serving" })),
      serving_size: Type.Optional(
        Type.String({ description: 'Serving size description, e.g. "1 cup", "2 slices"' }),
      ),
      notes: Type.Optional(Type.String({ description: "Additional notes" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        name: string;
        category?: string;
        quantity?: number;
        unit?: string;
        calories_per_serving?: number;
        protein_g_per_serving?: number;
        carbs_g_per_serving?: number;
        fat_g_per_serving?: number;
        serving_size?: string;
        notes?: string;
      },
    ) {
      try {
        const item = db.addPantryItem(params);
        return jsonResult({ item });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
