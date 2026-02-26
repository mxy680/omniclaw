import type { Exercise } from "@/lib/fitness-data";

interface ExerciseListProps {
  exercises: Exercise[];
}

export function ExerciseList({ exercises }: ExerciseListProps) {
  return (
    <div className="space-y-3">
      {exercises.map((ex) => {
        const summary = summarizeSets(ex);
        return (
          <div key={ex.name} className="space-y-0.5">
            <span className="text-sm font-medium">{ex.name}</span>
            <p className="text-xs text-muted-foreground tabular-nums">
              {summary}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function summarizeSets(ex: Exercise): string {
  const allSame =
    ex.sets.every((s) => s.reps === ex.sets[0].reps && s.weight === ex.sets[0].weight);

  if (allSame) {
    return `${ex.sets.length}x${ex.sets[0].reps} @ ${ex.sets[0].weight} lb`;
  }

  return ex.sets
    .map((s) => `${s.reps} @ ${s.weight}`)
    .join(", ") + " lb";
}
