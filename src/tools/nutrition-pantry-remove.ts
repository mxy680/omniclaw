import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionRemovePantryItemTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_remove_pantry_item",
    label: "Remove Pantry Item",
    description: "Remove an item from the pantry inventory.",
    parameters: Type.Object({
      id: Type.Number({ description: "ID of the pantry item to remove" }),
    }),
    async execute(_toolCallId: string, params: { id: number }) {
      try {
        const success = db.removePantryItem(params.id);
        if (!success) {
          return jsonResult({ success: false, message: `Pantry item with id ${params.id} not found` });
        }
        return jsonResult({ success: true, message: `Pantry item ${params.id} removed` });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
