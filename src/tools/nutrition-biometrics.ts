import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult, todayStr, daysAgoStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionBiometricsTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_biometrics",
    label: "Biometrics Log",
    description:
      "Query biometric measurements for a date range. Optionally filter by a specific metric (e.g. 'weight'). Defaults to the last 30 days.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to 30 days ago." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date (YYYY-MM-DD). Defaults to today." }),
      ),
      metric: Type.Optional(
        Type.String({ description: "Filter by metric name (e.g. 'weight', 'body_fat')." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: string; end?: string; metric?: string },
    ) {
      try {
        const start = params.start ?? daysAgoStr(30);
        const end = params.end ?? todayStr();
        const biometrics = db.getBiometrics(start, end, params.metric);
        return jsonResult({ biometrics, count: biometrics.length });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
