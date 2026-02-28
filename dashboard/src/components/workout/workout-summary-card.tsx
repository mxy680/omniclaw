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

function buildRows(_workout: WorkoutSession, workoutPlan: WorkoutPlan | null): SummaryRow[] {
  if (!workoutPlan || workoutPlan.workoutType === "rest") {
    return [];
  }

  if (workoutPlan.workoutType === "strength") {
    const plannedVolume = workoutPlan.exercises.reduce(
      (s, e) => s + (e.targetSets?.reduce((v, set) => v + set.weight * set.reps, 0) ?? 0),
      0,
    );
    const plannedReps = workoutPlan.exercises.reduce(
      (s, e) => s + (e.targetSets?.reduce((v, set) => v + set.reps, 0) ?? 0),
      0,
    );
    const plannedSets = workoutPlan.exercises.reduce(
      (s, e) => s + (e.targetSets?.length ?? 0),
      0,
    );
    return [
      { label: "Planned Volume", value: plannedVolume.toLocaleString(), unit: "lb" },
      { label: "Total Sets", value: `${plannedSets}` },
      { label: "Total Reps", value: `${plannedReps}` },
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

  return [];
}
