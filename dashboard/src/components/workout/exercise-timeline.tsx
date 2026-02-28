import { Coffee } from "lucide-react";
import type { WorkoutSession, WorkoutPlan, WorkoutPlanExercise } from "@/lib/fitness-data";

interface ExerciseTimelineProps {
  workout: WorkoutSession;
  workoutPlan: WorkoutPlan | null;
  color: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ExerciseTimeline({ workout, workoutPlan, color }: ExerciseTimelineProps) {
  if (!workoutPlan || workoutPlan.workoutType === "rest") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
        <Coffee className="h-8 w-8 opacity-40" />
        <p className="text-sm">Recovery day — stretch and stay hydrated</p>
      </div>
    );
  }

  return <PlannedTimeline plan={workoutPlan} color={color} />;
}

function summarizePlanSets(plan: WorkoutPlanExercise): string {
  if (!plan.targetSets || plan.targetSets.length === 0) return "";
  const allSame = plan.targetSets.every(
    (s) => s.reps === plan.targetSets![0].reps && s.weight === plan.targetSets![0].weight,
  );
  if (allSame) {
    return `Target: ${plan.targetSets.length}\u00d7${plan.targetSets[0].reps} @ ${plan.targetSets[0].weight} lb`;
  }
  return "Target: " + plan.targetSets.map((s) => `${s.reps}@${s.weight}`).join(", ") + " lb";
}

function planVolume(plan: WorkoutPlanExercise): number {
  if (!plan.targetSets) return 0;
  return plan.targetSets.reduce((v, s) => v + s.weight * s.reps, 0);
}

function PlannedTimeline({ plan, color }: { plan: WorkoutPlan; color: string }) {
  if (plan.workoutType === "cardio") {
    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span>Planned: {plan.workoutName}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {plan.exercises.map((e) => (
            <div key={e.exerciseName} className="rounded-lg border border-dashed border-border bg-muted/10 p-3 space-y-1">
              <span className="text-sm font-medium">{e.exerciseName}</span>
              <div className="text-xs text-muted-foreground tabular-nums">
                {e.durationMin != null && <span>{e.durationMin} min</span>}
                {e.distance != null && <span> · {e.distance} mi</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Strength plan-only
  return (
    <div className="relative mt-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span>Planned: {plan.workoutName}</span>
      </div>

      {plan.exercises.length > 1 && (
        <div className="absolute left-[1.15rem] top-12 bottom-4 w-px bg-border/50" aria-hidden />
      )}

      <div className="space-y-0.5">
        {plan.exercises.map((e, idx) => (
          <div
            key={e.exerciseName}
            className="relative flex items-start gap-3 rounded-lg px-3 py-3 opacity-60"
          >
            <div className="flex w-5 shrink-0 items-center justify-center pt-1.5">
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground/60">
                {idx + 1}
              </span>
            </div>
            <div className="relative z-10 flex flex-col items-center pt-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full border-[1.5px] bg-transparent"
                style={{ borderColor: color }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium leading-tight">{e.exerciseName}</span>
              {e.targetSets && (
                <p className="mt-0.5 text-xs text-muted-foreground/60 tabular-nums">
                  {summarizePlanSets(e)}
                </p>
              )}
            </div>
            {e.targetSets && (
              <div className="shrink-0 text-right">
                <span className="text-xs font-medium text-muted-foreground/60">
                  {planVolume(e).toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground/40"> lb</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


