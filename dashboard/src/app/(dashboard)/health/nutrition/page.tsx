"use client";

import { useState } from "react";
import { Apple, ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { DateNavigator } from "@/components/fitness/date-navigator";
import { MacroProgressBar } from "@/components/fitness/macro-progress-bar";
import { MealCard } from "@/components/fitness/meal-card";
import { MealPlanCard } from "@/components/fitness/meal-plan-card";
import { NutritionStatsBar } from "@/components/nutrition/nutrition-stats-bar";
import { PantryCard } from "@/components/nutrition/pantry-card";
import { useNutrition } from "@/hooks/use-nutrition";

const COLOR = "#f97316";

export default function NutritionPage() {
  const [date, setDate] = useState(new Date());
  const [showMicros, setShowMicros] = useState(false);

  const { nutrition, loading } = useNutrition(date);

  const shiftDate = (days: number) => {
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header + date nav */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          icon={Apple}
          color={COLOR}
          title="Nutrition"
          tagline="Food diary, macros, and meal planning"
        />
        <DateNavigator
          date={date}
          onPrev={() => shiftDate(-1)}
          onNext={() => shiftDate(1)}
        />
      </div>

      {loading || !nutrition ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {loading ? "Loading..." : "No data for this date"}
        </div>
      ) : (
        <>
          {/* Quick stats */}
          <NutritionStatsBar
            nutrition={nutrition.dailyNutrition}
            color={COLOR}
          />

          {/* Meal plan (when available) */}
          {nutrition.mealPlan && (
            <MealPlanCard plan={nutrition.mealPlan} color={COLOR} />
          )}

          {/* Two-column grid: macros + food log */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left column — Macro progress */}
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Macro Progress
              </h2>
              <div className="mt-4 space-y-4">
                <MacroProgressBar
                  label="Calories"
                  macro={nutrition.dailyNutrition.calories}
                  color={COLOR}
                />
                <MacroProgressBar
                  label="Protein"
                  macro={nutrition.dailyNutrition.protein}
                  color="#3b82f6"
                />
                <MacroProgressBar
                  label="Carbs"
                  macro={nutrition.dailyNutrition.carbs}
                  color="#eab308"
                />
                <MacroProgressBar
                  label="Fat"
                  macro={nutrition.dailyNutrition.fat}
                  color="#a855f7"
                />
              </div>

              {/* Micronutrients — collapsed */}
              <div className="mt-5">
                <button
                  onClick={() => setShowMicros(!showMicros)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronRight
                    className={`h-3 w-3 transition-transform duration-200 ${
                      showMicros ? "rotate-90" : ""
                    }`}
                  />
                  Micronutrients
                </button>
                {showMicros && (
                  <div className="mt-3 space-y-3">
                    <MacroProgressBar
                      label="Fiber"
                      macro={nutrition.dailyNutrition.fiber}
                      color="#22c55e"
                    />
                    <MacroProgressBar
                      label="Sodium"
                      macro={nutrition.dailyNutrition.sodium}
                      color="#71717a"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right column — Food log */}
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Food Log
              </h2>
              <div className="mt-4 space-y-2">
                {nutrition.dailyNutrition.meals.length > 0 ? (
                  nutrition.dailyNutrition.meals.map((meal) => (
                    <MealCard key={meal.name} meal={meal} />
                  ))
                ) : (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    No meals logged
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pantry */}
          <PantryCard items={nutrition.pantryItems} color={COLOR} />
        </>
      )}
    </div>
  );
}
