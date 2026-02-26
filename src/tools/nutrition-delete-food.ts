import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionDeleteFoodTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_delete_food",
    label: "Delete Food Entry",
    description: "Delete a food entry from the nutrition diary by its ID.",
    parameters: Type.Object({
      id: Type.Number({ description: "The ID of the food entry to delete." }),
    }),
    async execute(_toolCallId: string, params: { id: number }) {
      try {
        const deleted = db.deleteFoodEntry(params.id);
        return jsonResult({
          success: deleted,
          message: deleted
            ? `Food entry ${params.id} deleted.`
            : `Food entry ${params.id} not found.`,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
