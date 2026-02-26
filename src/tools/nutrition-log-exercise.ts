import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionLogExerciseTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_log_exercise",
    label: "Log Exercise",
    description:
      "Log an exercise session. Supports cardio, strength, flexibility, and other exercise types with optional details like sets/reps or distance.",
    parameters: Type.Object({
      name: Type.String({ description: "Name of the exercise (e.g. 'Running', 'Bench Press')" }),
      date: Type.Optional(
        Type.String({ description: "Date in YYYY-MM-DD format. Defaults to today." }),
      ),
      exercise_type: Type.Optional(
        Type.String({ description: "Type: cardio, strength, flexibility, or other." }),
      ),
      duration_min: Type.Optional(Type.Number({ description: "Duration in minutes." })),
      calories_burned: Type.Optional(Type.Number({ description: "Estimated calories burned." })),
      details: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description: "Additional details as key-value pairs (e.g. sets, reps, distance, pace).",
        }),
      ),
      notes: Type.Optional(Type.String({ description: "Notes about the exercise session." })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        name: string;
        date?: string;
        exercise_type?: string;
        duration_min?: number;
        calories_burned?: number;
        details?: Record<string, unknown>;
        notes?: string;
      },
    ) {
      try {
        const entry = db.addExercise({
          date: params.date ?? todayStr(),
          name: params.name,
          exercise_type: params.exercise_type,
          duration_min: params.duration_min,
          calories_burned: params.calories_burned,
          details: params.details,
          notes: params.notes,
        });
        return jsonResult({ logged: entry });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
