import type { FitnessDay } from "@/lib/fitness-data";
import { Flame, Beef, Scale, Dumbbell } from "lucide-react";

interface QuickStatsBarProps {
  data: FitnessDay;
  color: string;
}

export function QuickStatsBar({ data, color }: QuickStatsBarProps) {
  const { nutrition, workout, body } = data;
  const workoutLabel =
    workout.type === "rest"
      ? "Rest Day"
      : workout.status === "completed"
        ? workout.name
        : "Scheduled";

  const stats = [
    {
      icon: Flame,
      label: "Calories",
      value: `${nutrition.calories.current.toLocaleString()}`,
      sub: `/ ${nutrition.calories.target.toLocaleString()}`,
    },
    {
      icon: Beef,
      label: "Protein",
      value: `${nutrition.protein.current}g`,
      sub: `/ ${nutrition.protein.target}g`,
    },
    {
      icon: Scale,
      label: "Weight",
      value: `${body.latest.weight} lb`,
      sub:
        body.weightDelta !== 0
          ? `${body.weightDelta > 0 ? "+" : ""}${body.weightDelta} lb`
          : undefined,
    },
    {
      icon: Dumbbell,
      label: "Workout",
      value: workoutLabel,
      sub: workout.status === "completed" ? "Done" : undefined,
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
            <s.icon
              className="h-3.5 w-3.5"
              style={{ color }}
            />
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tracking-tight">
              {s.value}
            </span>
            {s.sub && (
              <span className="text-xs text-muted-foreground">{s.sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
