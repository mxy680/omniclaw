"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DailyNutrition } from "@/lib/fitness-data";
import { MacroProgressBar } from "./macro-progress-bar";
import { MealCard } from "./meal-card";

interface NutritionColumnProps {
  nutrition: DailyNutrition;
  color: string;
}

export function NutritionColumn({ nutrition, color }: NutritionColumnProps) {
  const [showMicros, setShowMicros] = useState(false);

  return (
    <div className="space-y-5">
      {/* Section label */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Nutrition
      </h2>

      {/* Main macros */}
      <div className="space-y-4">
        <MacroProgressBar label="Calories" macro={nutrition.calories} color={color} />
        <MacroProgressBar label="Protein" macro={nutrition.protein} color="#3b82f6" />
        <MacroProgressBar label="Carbs" macro={nutrition.carbs} color="#eab308" />
        <MacroProgressBar label="Fat" macro={nutrition.fat} color="#a855f7" />
      </div>

      {/* Meals */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground/70">Meals</h3>
        <div className="space-y-1.5">
          {nutrition.meals.map((meal) => (
            <MealCard key={meal.name} meal={meal} />
          ))}
        </div>
      </div>

      {/* Micronutrients — collapsed */}
      <div>
        <button
          onClick={() => setShowMicros(!showMicros)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight
            className={`h-3 w-3 transition-transform duration-200 ${showMicros ? "rotate-90" : ""}`}
          />
          Micronutrients
        </button>
        {showMicros && (
          <div className="mt-3 space-y-3">
            <MacroProgressBar label="Fiber" macro={nutrition.fiber} color="#22c55e" />
            <MacroProgressBar label="Sodium" macro={nutrition.sodium} color="#71717a" />
          </div>
        )}
      </div>
    </div>
  );
}
