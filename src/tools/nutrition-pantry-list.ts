import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionListPantryTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_list_pantry",
    label: "List Pantry",
    description:
      "List all items in the pantry inventory. Optionally filter by category.",
    parameters: Type.Object({
      category: Type.Optional(
        Type.String({
          description:
            "Filter by category: snack, protein, dairy, grain, fruit, vegetable, condiment, other",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { category?: string }) {
      try {
        const items = db.listPantryItems(params.category);
        return jsonResult({ items, count: items.length });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
