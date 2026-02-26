import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionDiaryTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_diary",
    label: "Nutrition Diary",
    description:
      "Query the nutrition diary for a date range. Returns food entries grouped by day and meal, daily macro totals, and active targets.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to today." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date (YYYY-MM-DD). Defaults to start date." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: string; end?: string },
    ) {
      try {
        const start = params.start ?? todayStr();
        const end = params.end ?? start;
        const { entries, daily_totals } = db.getFoodEntries(start, end);
        const targets = db.getActiveTargets();

        // Group entries by date and meal
        const grouped: Record<string, Record<string, typeof entries>> = {};
        for (const entry of entries) {
          const day = entry.date;
          const meal = entry.meal ?? "other";
          if (!grouped[day]) grouped[day] = {};
          if (!grouped[day][meal]) grouped[day][meal] = [];
          grouped[day][meal].push(entry);
        }

        return jsonResult({ diary: grouped, daily_totals, targets });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
