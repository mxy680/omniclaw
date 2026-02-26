import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionDeleteExerciseTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_delete_exercise",
    label: "Delete Exercise",
    description: "Delete an exercise entry by its ID.",
    parameters: Type.Object({
      id: Type.Number({ description: "The ID of the exercise entry to delete." }),
    }),
    async execute(_toolCallId: string, params: { id: number }) {
      try {
        const deleted = db.deleteExercise(params.id);
        return jsonResult({
          success: deleted,
          message: deleted
            ? `Exercise ${params.id} deleted.`
            : `Exercise ${params.id} not found.`,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
