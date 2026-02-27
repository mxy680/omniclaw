import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import type { WorkoutPlanEntryInput } from "../nutrition/types.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionSaveWorkoutProgramTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_save_workout_program",
    label: "Save Workout Program",
    description:
      "Bulk-save a multi-day workout program. Dates auto-increment from start_date. Replaces existing plans for each date.",
    parameters: Type.Object({
      start_date: Type.String({ description: "Start date in YYYY-MM-DD format" }),
      days: Type.Array(
        Type.Object({
          workout_name: Type.String({ description: 'Name of the workout, e.g. "Push Day"' }),
          workout_type: Type.Union(
            [Type.Literal("strength"), Type.Literal("cardio"), Type.Literal("rest")],
            { description: "Type of workout" },
          ),
          exercises: Type.Array(
            Type.Object({
              exercise_name: Type.String({ description: "Name of the exercise" }),
              target_sets: Type.Optional(
                Type.Array(
                  Type.Object({
                    reps: Type.Number({ description: "Target reps for this set" }),
                    weight: Type.Number({ description: "Target weight for this set" }),
                  }),
                  { description: "Array of target sets with reps and weight" },
                ),
              ),
              duration_min: Type.Optional(Type.Number({ description: "Duration in minutes" })),
              distance: Type.Optional(Type.Number({ description: "Distance (unit determined by context)" })),
              notes: Type.Optional(Type.String({ description: "Notes for this exercise" })),
            }),
            { description: "Array of exercises in this workout day" },
          ),
        }),
        { description: "Array of workout days to save" },
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        start_date: string;
        days: Array<{
          workout_name: string;
          workout_type: "strength" | "cardio" | "rest";
          exercises: Array<{
            exercise_name: string;
            target_sets?: { reps: number; weight: number }[];
            duration_min?: number;
            distance?: number;
            notes?: string;
          }>;
        }>;
      },
    ) {
      try {
        const summary: { date: string; workout_name: string; exercise_count: number }[] = [];
        const baseDate = new Date(params.start_date);

        for (let i = 0; i < params.days.length; i++) {
          const day = params.days[i];
          const d = new Date(baseDate);
          d.setDate(d.getDate() + i);
          const date = d.toISOString().split("T")[0];

          const entries: WorkoutPlanEntryInput[] = day.exercises.map((e, j) => ({
            date,
            workout_name: day.workout_name,
            workout_type: day.workout_type,
            exercise_order: j,
            exercise_name: e.exercise_name,
            target_sets: e.target_sets,
            duration_min: e.duration_min,
            distance: e.distance,
            notes: e.notes,
          }));

          db.saveWorkoutPlan(date, entries);
          summary.push({ date, workout_name: day.workout_name, exercise_count: day.exercises.length });
        }

        return jsonResult({
          days_saved: params.days.length,
          start_date: params.start_date,
          summary,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
