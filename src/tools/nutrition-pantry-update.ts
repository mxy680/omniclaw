import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionUpdatePantryItemTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_update_pantry_item",
    label: "Update Pantry Item",
    description:
      "Update an existing pantry item's details (name, quantity, macros, etc.).",
    parameters: Type.Object({
      id: Type.Number({ description: "ID of the pantry item to update" }),
      name: Type.Optional(Type.String({ description: "New name" })),
      category: Type.Optional(Type.String({ description: "New category" })),
      quantity: Type.Optional(Type.Number({ description: "New quantity" })),
      unit: Type.Optional(Type.String({ description: "New unit" })),
      calories_per_serving: Type.Optional(Type.Number({ description: "Calories per serving" })),
      protein_g_per_serving: Type.Optional(Type.Number({ description: "Protein (g) per serving" })),
      carbs_g_per_serving: Type.Optional(Type.Number({ description: "Carbs (g) per serving" })),
      fat_g_per_serving: Type.Optional(Type.Number({ description: "Fat (g) per serving" })),
      serving_size: Type.Optional(Type.String({ description: "Serving size description" })),
      notes: Type.Optional(Type.String({ description: "Additional notes" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        id: number;
        name?: string;
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
        const { id, ...updates } = params;
        const item = db.updatePantryItem(id, updates);
        if (!item) {
          return jsonResult({ error: `Pantry item with id ${id} not found` });
        }
        return jsonResult({ item });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
