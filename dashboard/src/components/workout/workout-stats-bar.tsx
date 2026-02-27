import {
  Dumbbell,
  ListChecks,
  Layers,
  Weight,
  Clock,
  Flame,
  Route,
  Heart,
  Minus,
} from "lucide-react";
import type { WorkoutSession } from "@/lib/fitness-data";

interface WorkoutStatsBarProps {
  workout: WorkoutSession;
  color: string;
}

export function WorkoutStatsBar({ workout, color }: WorkoutStatsBarProps) {
  const stats = buildStats(workout);

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

interface StatItem {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub?: string;
}

function buildStats(workout: WorkoutSession): StatItem[] {
  if (workout.type === "strength" && workout.exercises) {
    const totalSets = workout.exercises.reduce(
      (s, e) => s + e.sets.length,
      0,
    );
    const totalVolume = workout.exercises.reduce(
      (s, e) => s + e.sets.reduce((v, set) => v + set.weight * set.reps, 0),
      0,
    );
    return [
      { icon: Dumbbell, label: "Workout", value: workout.name, sub: "Completed" },
      { icon: ListChecks, label: "Exercises", value: `${workout.exercises.length}`, sub: "exercises" },
      { icon: Layers, label: "Total Sets", value: `${totalSets}`, sub: "sets" },
      { icon: Weight, label: "Volume", value: totalVolume.toLocaleString(), sub: "lb" },
    ];
  }

  if (workout.type === "cardio" && workout.cardio) {
    const c = workout.cardio;
    const stats: StatItem[] = [
      { icon: Dumbbell, label: "Workout", value: workout.name, sub: "Completed" },
      { icon: Clock, label: "Duration", value: `${c.duration}`, sub: "min" },
      { icon: Flame, label: "Calories", value: `${c.caloriesBurned}`, sub: "cal" },
    ];
    if (c.distance != null) {
      stats.push({ icon: Route, label: "Distance", value: `${c.distance}`, sub: "mi" });
    } else if (c.heartRate != null) {
      stats.push({ icon: Heart, label: "Avg HR", value: `${c.heartRate}`, sub: "bpm" });
    } else {
      stats.push({ icon: Minus, label: "—", value: "—" });
    }
    return stats;
  }

  // Rest day
  return [
    { icon: Dumbbell, label: "Workout", value: "Rest Day" },
    { icon: Minus, label: "Exercises", value: "—" },
    { icon: Minus, label: "Sets", value: "—" },
    { icon: Minus, label: "Volume", value: "—" },
  ];
}
