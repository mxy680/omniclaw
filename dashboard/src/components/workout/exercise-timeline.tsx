import { Clock, Route, Heart, Flame, Coffee } from "lucide-react";
import type { WorkoutSession, Exercise, WorkoutPlan, WorkoutPlanExercise } from "@/lib/fitness-data";

interface ExerciseTimelineProps {
  workout: WorkoutSession;
  workoutPlan: WorkoutPlan | null;
  color: string;
}

export function ExerciseTimeline({ workout, workoutPlan, color }: ExerciseTimelineProps) {
  // Plan-only: show planned workout when no actual logged yet
  if (workout.type === "rest" && workoutPlan && workoutPlan.workoutType !== "rest") {
    return <PlannedTimeline plan={workoutPlan} color={color} />;
  }

  if (workout.type === "rest") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
        <Coffee className="h-8 w-8 opacity-40" />
        <p className="text-sm">Recovery day — stretch and stay hydrated</p>
      </div>
    );
  }

  if (workout.type === "cardio" && workout.cardio) {
    const c = workout.cardio;
    return (
      <div className="mt-4 grid grid-cols-2 gap-4">
        <CardioStatBlock
          icon={Clock}
          label="Duration"
          value={`${c.duration}`}
          unit="min"
          color={color}
        />
        {c.distance != null && (
          <CardioStatBlock
            icon={Route}
            label="Distance"
            value={`${c.distance}`}
            unit="mi"
            color={color}
          />
        )}
        {c.heartRate != null && (
          <CardioStatBlock
            icon={Heart}
            label="Avg HR"
            value={`${c.heartRate}`}
            unit="bpm"
            color={color}
          />
        )}
        <CardioStatBlock
          icon={Flame}
          label="Calories"
          value={`${c.caloriesBurned}`}
          unit="cal"
          color={color}
        />
      </div>
    );
  }

  // Strength
  const exercises = workout.exercises ?? [];
  const planned = workoutPlan?.exercises ?? [];

  // Build match map: planned exercise name (lowercase) → planned exercise
  const planMap = new Map<string, WorkoutPlanExercise>();
  for (const p of planned) {
    planMap.set(p.exerciseName.toLowerCase(), p);
  }

  // Merge: start with actual exercises, append any planned-only exercises
  const mergedExercises: Array<{ actual: Exercise | null; plan: WorkoutPlanExercise | null }> = [];
  const matchedPlanNames = new Set<string>();

  for (const ex of exercises) {
    const planMatch = planMap.get(ex.name.toLowerCase()) ?? null;
    if (planMatch) matchedPlanNames.add(planMatch.exerciseName.toLowerCase());
    mergedExercises.push({ actual: ex, plan: planMatch });
  }

  // Add unmatched planned exercises at the end (not yet performed)
  for (const p of planned) {
    if (!matchedPlanNames.has(p.exerciseName.toLowerCase())) {
      mergedExercises.push({ actual: null, plan: p });
    }
  }

  return (
    <div className="relative mt-4">
      {mergedExercises.length > 1 && (
        <div className="absolute left-[1.15rem] top-4 bottom-4 w-px bg-border" aria-hidden />
      )}

      <div className="space-y-0.5">
        {mergedExercises.map((item, idx) => {
          const name = item.actual?.name ?? item.plan!.exerciseName;
          const isPlannedOnly = !item.actual;

          return (
            <div
              key={`${name}-${idx}`}
              className={`relative flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/30 ${isPlannedOnly ? "opacity-50" : ""}`}
            >
              {/* Index column */}
              <div className="flex w-5 shrink-0 items-center justify-center pt-1.5">
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground/60">
                  {idx + 1}
                </span>
              </div>

              {/* Timeline dot */}
              <div className="relative z-10 flex flex-col items-center pt-1.5">
                <div
                  className={`h-2.5 w-2.5 rounded-full ring-2 ring-card/40 ${isPlannedOnly ? "border-[1.5px] bg-transparent" : ""}`}
                  style={isPlannedOnly ? { borderColor: color } : { backgroundColor: color }}
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium leading-tight">
                  {name}
                  {isPlannedOnly && (
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(planned)</span>
                  )}
                </span>
                {item.actual && (
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {summarizeSets(item.actual)}
                  </p>
                )}
                {isPlannedOnly && item.plan?.targetSets && (
                  <p className="mt-0.5 text-xs text-muted-foreground/60 tabular-nums">
                    {summarizePlanSets(item.plan)}
                  </p>
                )}
                {/* Plan comparison badge when both exist */}
                {item.actual && item.plan?.targetSets && (
                  <ComparisonBadge actual={item.actual} plan={item.plan} />
                )}
              </div>

              {/* Volume */}
              <div className="shrink-0 text-right">
                {item.actual ? (
                  <>
                    <span className="text-xs font-medium">
                      {exerciseVolume(item.actual).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground"> lb</span>
                  </>
                ) : item.plan?.targetSets ? (
                  <>
                    <span className="text-xs font-medium text-muted-foreground/60">
                      {planVolume(item.plan).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40"> lb</span>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function summarizeSets(ex: Exercise): string {
  const allSame = ex.sets.every(
    (s) => s.reps === ex.sets[0].reps && s.weight === ex.sets[0].weight,
  );

  if (allSame) {
    return `${ex.sets.length}\u00d7${ex.sets[0].reps} @ ${ex.sets[0].weight} lb`;
  }

  return (
    ex.sets.map((s) => `${s.reps}@${s.weight}`).join(", ") + " lb"
  );
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

function exerciseVolume(ex: Exercise): number {
  return ex.sets.reduce((v, s) => v + s.weight * s.reps, 0);
}

function planVolume(plan: WorkoutPlanExercise): number {
  if (!plan.targetSets) return 0;
  return plan.targetSets.reduce((v, s) => v + s.weight * s.reps, 0);
}

function ComparisonBadge({ actual, plan }: { actual: Exercise; plan: WorkoutPlanExercise }) {
  const actualVol = exerciseVolume(actual);
  const plannedVol = planVolume(plan);
  if (plannedVol === 0) return null;

  const pct = Math.round((actualVol / plannedVol) * 100);
  let badgeColor = "text-emerald-500 bg-emerald-500/10";
  if (pct < 80) badgeColor = "text-red-400 bg-red-400/10";
  else if (pct < 100) badgeColor = "text-amber-500 bg-amber-500/10";

  return (
    <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badgeColor}`}>
      {pct}% of plan
    </span>
  );
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

function CardioStatBlock({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-muted/20 p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span className="text-[10px] font-medium text-muted-foreground/60">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
