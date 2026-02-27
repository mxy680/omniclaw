import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import type { WorkoutPlanEntryInput } from "../nutrition/types.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionSaveWorkoutPlanTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_save_workout_plan",
    label: "Save Workout Plan",
    description:
      "Save a daily workout plan with exercises and target sets/reps/weight. Replaces any existing plan for the date.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({ description: "Date in YYYY-MM-DD format. Defaults to today." }),
      ),
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
        { description: "Array of exercises in this workout" },
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        date?: string;
        workout_name: string;
        workout_type: "strength" | "cardio" | "rest";
        exercises: Array<{
          exercise_name: string;
          target_sets?: { reps: number; weight: number }[];
          duration_min?: number;
          distance?: number;
          notes?: string;
        }>;
      },
    ) {
      try {
        const date = params.date ?? todayStr();
        const entries: WorkoutPlanEntryInput[] = params.exercises.map((e, i) => ({
          date,
          workout_name: params.workout_name,
          workout_type: params.workout_type,
          exercise_order: i,
          exercise_name: e.exercise_name,
          target_sets: e.target_sets,
          duration_min: e.duration_min,
          distance: e.distance,
          notes: e.notes,
        }));

        db.saveWorkoutPlan(date, entries);

        return jsonResult({
          date,
          workout_name: params.workout_name,
          workout_type: params.workout_type,
          exercises: params.exercises,
          exercise_count: params.exercises.length,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
