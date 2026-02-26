"use client";

import { Clock, UtensilsCrossed, Leaf } from "lucide-react";
import type { DailyMealPlan } from "@/lib/fitness-data";

interface MealPlanCardProps {
  plan: DailyMealPlan;
  color: string;
}

export function MealPlanCard({ plan, color }: MealPlanCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Meal Plan
        </h2>
        <span className="text-xs text-muted-foreground">
          {plan.totalCalories.toLocaleString()} kcal planned
        </span>
      </div>

      {/* Timeline */}
      <div className="mt-4 space-y-1">
        {plan.entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30"
          >
            {/* Time */}
            <div className="flex w-16 shrink-0 items-center gap-1.5 pt-0.5">
              <Clock className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-xs font-medium text-muted-foreground">
                {entry.timeLabel}
              </span>
            </div>

            {/* Divider dot */}
            <div className="flex flex-col items-center pt-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium leading-tight">
                  {entry.itemName}
                </span>
                <SourceBadge source={entry.source} />
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="text-[10px] font-medium text-muted-foreground/60">
                  {entry.mealLabel}
                </span>
              </div>
            </div>

            {/* Compact macros */}
            {entry.calories != null && (
              <div className="shrink-0 text-right">
                <span className="text-xs font-medium">{entry.calories}</span>
                <span className="text-[10px] text-muted-foreground"> kcal</span>
                {entry.protein != null && (
                  <div className="text-[10px] text-muted-foreground">
                    P{entry.protein} C{entry.carbs ?? 0} F{entry.fat ?? 0}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Plan totals
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span>
            <span className="font-semibold">{plan.totalCalories}</span>
            <span className="text-muted-foreground"> kcal</span>
          </span>
          <span className="text-muted-foreground">
            P{plan.totalProtein}g · C{plan.totalCarbs}g · F{plan.totalFat}g
          </span>
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "factor75") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
        <UtensilsCrossed className="h-2.5 w-2.5" />
        Factor75
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
      <Leaf className="h-2.5 w-2.5" />
      Pantry
    </span>
  );
}
