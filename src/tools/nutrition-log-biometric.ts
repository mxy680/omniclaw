import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionLogBiometricTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_log_biometric",
    label: "Log Biometric",
    description:
      "Log a biometric measurement such as weight, body fat percentage, blood pressure, or resting heart rate.",
    parameters: Type.Object({
      metric: Type.String({
        description: "Metric name: weight, body_fat, blood_pressure, resting_hr, or any custom metric.",
      }),
      value: Type.Number({ description: "Measured value." }),
      unit: Type.String({ description: "Unit of measurement (lbs, kg, %, mmHg, bpm, etc.)." }),
      date: Type.Optional(
        Type.String({ description: "Date in YYYY-MM-DD format. Defaults to today." }),
      ),
      notes: Type.Optional(Type.String({ description: "Notes about this measurement." })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        metric: string;
        value: number;
        unit: string;
        date?: string;
        notes?: string;
      },
    ) {
      try {
        const entry = db.addBiometric({
          date: params.date ?? todayStr(),
          metric: params.metric,
          value: params.value,
          unit: params.unit,
          notes: params.notes,
        });
        return jsonResult({ logged: entry });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
