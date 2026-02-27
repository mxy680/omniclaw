"use client";

import { useFitness } from "./use-fitness";
import type { WorkoutSession, WeekDay, WorkoutPlan } from "@/lib/fitness-data";

export interface WorkoutPageData {
  workout: WorkoutSession;
  weekOverview: WeekDay[];
  workoutPlan: WorkoutPlan | null;
  date: Date;
}

export function useWorkout(date: Date) {
  const { data, loading, connectionState, isConnected } = useFitness(date);

  const workout: WorkoutPageData | null = data
    ? {
        workout: data.workout,
        weekOverview: data.weekOverview,
        workoutPlan: data.workoutPlan,
        date: data.date,
      }
    : null;

  return { workout, loading, connectionState, isConnected };
}
