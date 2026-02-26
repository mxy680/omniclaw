import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult, todayStr, daysAgoStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionExercisesTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_exercises",
    label: "Exercise Log",
    description:
      "Query exercise entries for a date range. Defaults to the last 7 days.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to 7 days ago." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date (YYYY-MM-DD). Defaults to today." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: string; end?: string },
    ) {
      try {
        const start = params.start ?? daysAgoStr(7);
        const end = params.end ?? todayStr();
        const exercises = db.getExercises(start, end);
        return jsonResult({ exercises, count: exercises.length });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
