"use client";

import { useState } from "react";
import { Apple, Clock, UtensilsCrossed, Leaf } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { DateNavigator } from "@/components/fitness/date-navigator";
import { NutritionStatsBar } from "@/components/nutrition/nutrition-stats-bar";
import { MicronutrientsCard } from "@/components/nutrition/micronutrients-card";
import { MacroRatioRing } from "@/components/nutrition/macro-ratio-ring";
import { useNutrition } from "@/hooks/use-nutrition";
import type { MealPlanSlot } from "@/lib/fitness-data";

const COLOR = "#f97316";

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

function PlannedMealsTimeline({
  entries,
  color,
}: {
  entries: MealPlanSlot[];
  color: string;
}) {
  return (
    <div className="relative mt-4">
      {entries.length > 1 && (
        <div
          className="absolute left-[4.75rem] top-4 bottom-4 w-px bg-border"
          aria-hidden
        />
      )}

      <div className="space-y-0.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="relative flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/30"
          >
            <div className="flex w-14 shrink-0 items-center gap-1.5 pt-0.5">
              <Clock className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {entry.timeLabel}
              </span>
            </div>

            <div className="relative z-10 flex flex-col items-center pt-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full ring-2 ring-card/40"
                style={{ backgroundColor: color }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium leading-tight">
                  {entry.itemName}
                </span>
                <SourceBadge source={entry.source} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground/60">
                {entry.mealLabel}
              </span>
            </div>

            {entry.calories != null && (
              <div className="shrink-0 text-right">
                <span className="text-xs font-medium">{entry.calories}</span>
                <span className="text-[10px] text-muted-foreground"> kcal</span>
                {entry.protein != null && (
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    P{entry.protein} C{entry.carbs ?? 0} F{entry.fat ?? 0}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NutritionPage() {
  const [date, setDate] = useState(new Date());

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
          tagline="Meal plan & macros"
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
          {/* Quick stats bar */}
          <NutritionStatsBar
            nutrition={nutrition.dailyNutrition}
            color={COLOR}
          />

          {/* Two-column: meals timeline + stats sidebar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left — Planned meals timeline */}
            <div className="rounded-xl border border-border bg-card/40 p-5 lg:col-span-7">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Planned Meals
                </h2>
                {nutrition.mealPlan && (
                  <span className="text-xs text-muted-foreground">
                    {nutrition.mealPlan.totalCalories.toLocaleString()} kcal
                  </span>
                )}
              </div>

              {nutrition.mealPlan && nutrition.mealPlan.entries.length > 0 ? (
                <>
                  <PlannedMealsTimeline
                    entries={nutrition.mealPlan.entries}
                    color={COLOR}
                  />

                  {/* Totals */}
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Plan totals
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span>
                        <span className="font-semibold">
                          {nutrition.mealPlan.totalCalories}
                        </span>
                        <span className="text-muted-foreground"> kcal</span>
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        P{nutrition.mealPlan.totalProtein}g · C
                        {nutrition.mealPlan.totalCarbs}g · F
                        {nutrition.mealPlan.totalFat}g
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  No meal plan for this day
                </div>
              )}
            </div>

            {/* Right — Stats sidebar */}
            <div className="space-y-6 lg:col-span-5">
              <MacroRatioRing nutrition={nutrition.dailyNutrition} />
              <MicronutrientsCard nutrition={nutrition.dailyNutrition} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
