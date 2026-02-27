"use client";

import { MacroProgressBar } from "@/components/fitness/macro-progress-bar";
import type { DailyNutrition } from "@/lib/fitness-data";

interface MicronutrientsCardProps {
  nutrition: DailyNutrition;
}

export function MicronutrientsCard({ nutrition }: MicronutrientsCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Micronutrients
      </h2>
      <div className="mt-4 space-y-4">
        <MacroProgressBar label="Fiber" macro={nutrition.fiber} color="#22c55e" />
        <MacroProgressBar label="Sodium" macro={nutrition.sodium} color="#71717a" />
        <MacroProgressBar label="Potassium" macro={nutrition.potassium} color="#f59e0b" />
      </div>
    </div>
  );
}
