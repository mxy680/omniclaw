import { Flame, Beef, Wheat, Droplet } from "lucide-react";
import type { DailyNutrition } from "@/lib/fitness-data";

interface NutritionStatsBarProps {
  nutrition: DailyNutrition;
  color: string;
}

export function NutritionStatsBar({ nutrition, color }: NutritionStatsBarProps) {
  const stats = [
    {
      icon: Flame,
      label: "Calories",
      value: `${nutrition.calories.current.toLocaleString()}`,
      sub: `/ ${nutrition.calories.target.toLocaleString()} ${nutrition.calories.unit}`,
      pct: nutrition.calories.target > 0
        ? Math.round((nutrition.calories.current / nutrition.calories.target) * 100)
        : 0,
    },
    {
      icon: Beef,
      label: "Protein",
      value: `${nutrition.protein.current}${nutrition.protein.unit}`,
      sub: `/ ${nutrition.protein.target}${nutrition.protein.unit}`,
      pct: nutrition.protein.target > 0
        ? Math.round((nutrition.protein.current / nutrition.protein.target) * 100)
        : 0,
    },
    {
      icon: Wheat,
      label: "Carbs",
      value: `${nutrition.carbs.current}${nutrition.carbs.unit}`,
      sub: `/ ${nutrition.carbs.target}${nutrition.carbs.unit}`,
      pct: nutrition.carbs.target > 0
        ? Math.round((nutrition.carbs.current / nutrition.carbs.target) * 100)
        : 0,
    },
    {
      icon: Droplet,
      label: "Fat",
      value: `${nutrition.fat.current}${nutrition.fat.unit}`,
      sub: `/ ${nutrition.fat.target}${nutrition.fat.unit}`,
      pct: nutrition.fat.target > 0
        ? Math.round((nutrition.fat.current / nutrition.fat.target) * 100)
        : 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-border bg-card/50 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <s.icon className="h-3.5 w-3.5" style={{ color }} />
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/60">
              {s.pct}%
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tracking-tight">
              {s.value}
            </span>
            <span className="text-xs text-muted-foreground">{s.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
