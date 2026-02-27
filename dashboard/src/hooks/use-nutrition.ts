"use client";

import { useFitness } from "./use-fitness";
import type { DailyNutrition, DailyMealPlan, PantryItem } from "@/lib/fitness-data";

export interface NutritionPageData {
  dailyNutrition: DailyNutrition;
  mealPlan: DailyMealPlan | null;
  pantryItems: PantryItem[];
  date: Date;
}

export function useNutrition(date: Date) {
  const { data, loading, connectionState, isConnected } = useFitness(date);

  const nutrition: NutritionPageData | null = data
    ? {
        dailyNutrition: data.nutrition,
        mealPlan: data.mealPlan,
        pantryItems: data.pantryItems,
        date: data.date,
      }
    : null;

  return { nutrition, loading, connectionState, isConnected };
}
