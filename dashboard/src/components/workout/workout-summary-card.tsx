import type { WorkoutSession, WorkoutPlan } from "@/lib/fitness-data";

interface WorkoutSummaryCardProps {
  workout: WorkoutSession;
  workoutPlan: WorkoutPlan | null;
  color: string;
}

export function WorkoutSummaryCard({ workout, workoutPlan, color }: WorkoutSummaryCardProps) {
  const rows = buildRows(workout, workoutPlan);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workout Summary
        </h2>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          No workout data
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Workout Summary
      </h2>

      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{r.label}</span>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-sm font-semibold tabular-nums ${r.colorClass ?? ""}`}
                style={r.colorClass ? undefined : { color }}
              >
                {r.value}
              </span>
              {r.unit && (
                <span className="text-xs text-muted-foreground">{r.unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SummaryRow {
  label: string;
  value: string;
  unit?: string;
  colorClass?: string;
}

function buildRows(workout: WorkoutSession, workoutPlan: WorkoutPlan | null): SummaryRow[] {
  // Plan-only: rest day but plan exists — show planned stats
  if (workout.type === "rest" && workoutPlan && workoutPlan.workoutType !== "rest") {
    if (workoutPlan.workoutType === "strength") {
      const plannedVolume = workoutPlan.exercises.reduce(
        (s, e) => s + (e.targetSets?.reduce((v, set) => v + set.weight * set.reps, 0) ?? 0),
        0,
      );
      const plannedReps = workoutPlan.exercises.reduce(
        (s, e) => s + (e.targetSets?.reduce((v, set) => v + set.reps, 0) ?? 0),
        0,
      );
      return [
        { label: "Planned Volume", value: plannedVolume.toLocaleString(), unit: "lb" },
        { label: "Planned Reps", value: `${plannedReps}` },
        { label: "Exercises", value: `${workoutPlan.exercises.length}` },
      ];
    }
    if (workoutPlan.workoutType === "cardio") {
      const totalDuration = workoutPlan.exercises.reduce(
        (s, e) => s + (e.durationMin ?? 0),
        0,
      );
      const rows: SummaryRow[] = [];
      if (totalDuration > 0) {
        rows.push({ label: "Planned Duration", value: `${totalDuration}`, unit: "min" });
      }
      rows.push({ label: "Exercises", value: `${workoutPlan.exercises.length}` });
      return rows;
    }
  }

  if (workout.type === "strength" && workout.exercises) {
    const allSets = workout.exercises.flatMap((e) => e.sets);
    const totalVolume = allSets.reduce((s, set) => s + set.weight * set.reps, 0);
    const totalReps = allSets.reduce((s, set) => s + set.reps, 0);
    const heaviest = Math.max(...allSets.map((s) => s.weight));
    const avgWeight =
      allSets.length > 0
        ? allSets.reduce((s, set) => s + set.weight, 0) / allSets.length
        : 0;

    const rows: SummaryRow[] = [];

    // Add plan comparison when plan has exercises with target sets
    const planExercisesWithSets = workoutPlan?.exercises.filter((e) => e.targetSets && e.targetSets.length > 0) ?? [];
    if (planExercisesWithSets.length > 0) {
      const plannedVolume = planExercisesWithSets.reduce(
        (s, e) => s + (e.targetSets?.reduce((v, set) => v + set.weight * set.reps, 0) ?? 0),
        0,
      );
      const pct = plannedVolume > 0 ? Math.round((totalVolume / plannedVolume) * 100) : null;

      rows.push({ label: "Planned Volume", value: plannedVolume.toLocaleString(), unit: "lb" });
      rows.push({ label: "Total Volume", value: totalVolume.toLocaleString(), unit: "lb" });

      if (pct !== null) {
        let colorClass = "text-emerald-500";
        if (pct < 80) colorClass = "text-red-400";
        else if (pct < 100) colorClass = "text-amber-500";
        rows.push({ label: "Completion", value: `${pct}%`, colorClass });
      }
    } else {
      rows.push({ label: "Total Volume", value: totalVolume.toLocaleString(), unit: "lb" });
    }

    rows.push(
      { label: "Total Reps", value: `${totalReps}` },
      { label: "Heaviest Lift", value: `${heaviest}`, unit: "lb" },
      { label: "Avg Weight", value: avgWeight.toFixed(1), unit: "lb" },
    );

    return rows;
  }

  if (workout.type === "cardio" && workout.cardio) {
    const c = workout.cardio;
    const rows: SummaryRow[] = [
      { label: "Duration", value: `${c.duration}`, unit: "min" },
    ];
    if (c.distance != null) {
      rows.push({ label: "Distance", value: `${c.distance}`, unit: "mi" });
    }
    if (c.heartRate != null) {
      rows.push({ label: "Avg HR", value: `${c.heartRate}`, unit: "bpm" });
    }
    rows.push({ label: "Calories Burned", value: `${c.caloriesBurned}`, unit: "cal" });
    return rows;
  }

  return [];
}
