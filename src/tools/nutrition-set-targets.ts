import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionSetTargetsTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_set_targets",
    label: "Set Nutrition Targets",
    description:
      "Set daily macro/calorie targets. Deactivates any previous targets and sets new ones. All fields are optional — only set the ones you want to track.",
    parameters: Type.Object({
      calories: Type.Optional(Type.Number({ description: "Daily calorie target (kcal)." })),
      protein_g: Type.Optional(Type.Number({ description: "Daily protein target (grams)." })),
      carbs_g: Type.Optional(Type.Number({ description: "Daily carbohydrate target (grams)." })),
      fat_g: Type.Optional(Type.Number({ description: "Daily fat target (grams)." })),
      fiber_g: Type.Optional(Type.Number({ description: "Daily fiber target (grams)." })),
      sodium_mg: Type.Optional(Type.Number({ description: "Daily sodium target (milligrams)." })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        calories?: number;
        protein_g?: number;
        carbs_g?: number;
        fat_g?: number;
        fiber_g?: number;
        sodium_mg?: number;
      },
    ) {
      try {
        db.setTargets(params);
        const active = db.getActiveTargets();
        return jsonResult({ message: "Nutrition targets updated.", targets: active });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
