"use client";

import type { DailyNutrition, DailyMealPlan } from "@/lib/fitness-data";

interface PlanVsActualCardProps {
  nutrition: DailyNutrition;
  mealPlan: DailyMealPlan | null;
}

const METRICS = [
  { label: "Calories", unit: "kcal", planKey: "totalCalories" as const, actualKey: "calories" as const },
  { label: "Protein", unit: "g", planKey: "totalProtein" as const, actualKey: "protein" as const },
  { label: "Carbs", unit: "g", planKey: "totalCarbs" as const, actualKey: "carbs" as const },
  { label: "Fat", unit: "g", planKey: "totalFat" as const, actualKey: "fat" as const },
];

export function PlanVsActualCard({ nutrition, mealPlan }: PlanVsActualCardProps) {
  if (!mealPlan) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Plan vs Actual
        </h2>
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          No meal plan to compare
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Plan vs Actual
      </h2>

      <div className="mt-4 space-y-3">
        {METRICS.map((m) => {
          const planned = mealPlan[m.planKey];
          const actual = nutrition[m.actualKey].current;
          const diff = actual - planned;
          const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
          const barPct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
          const over = actual > planned;

          return (
            <div key={m.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{m.label}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="tabular-nums">
                    {actual.toLocaleString()}
                    <span className="text-muted-foreground/50">
                      {" "}/ {planned.toLocaleString()}
                      {m.unit !== "kcal" ? m.unit : ""}
                    </span>
                  </span>
                  <span
                    className={`w-12 text-right font-medium tabular-nums ${
                      over ? "text-red-400" : pct >= 80 ? "text-green-400" : "text-muted-foreground"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Stacked bar: planned (bg) vs actual (fill) */}
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barPct}%`,
                    backgroundColor: over ? "#ef4444" : pct >= 80 ? "#22c55e" : "#f97316",
                  }}
                />
              </div>

              {/* Diff label */}
              <div className="text-right">
                <span
                  className={`text-[10px] tabular-nums ${
                    diff > 0
                      ? "text-red-400/80"
                      : diff < 0
                        ? "text-muted-foreground/60"
                        : "text-green-400/80"
                  }`}
                >
                  {diff > 0 ? "+" : ""}
                  {diff.toLocaleString()}
                  {m.unit !== "kcal" ? m.unit : " kcal"} {diff > 0 ? "over" : diff < 0 ? "remaining" : "on target"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
