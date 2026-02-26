import type { WorkoutSession, WeekDay } from "@/lib/fitness-data";
import { ExerciseList } from "./exercise-list";
import { Clock, Flame, Heart, Route } from "lucide-react";

interface WorkoutColumnProps {
  workout: WorkoutSession;
  weekOverview: WeekDay[];
  color: string;
}

export function WorkoutColumn({ workout, weekOverview, color }: WorkoutColumnProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Workout
      </h2>

      {/* Today's session card */}
      <div className="rounded-lg border border-border bg-card/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{workout.name}</span>
          <StatusBadge status={workout.status} color={color} />
        </div>

        {workout.type === "strength" && workout.exercises && (
          <div className="mt-4">
            <ExerciseList exercises={workout.exercises} />
          </div>
        )}

        {workout.type === "cardio" && workout.cardio && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <CardioStat icon={Clock} label="Duration" value={`${workout.cardio.duration} min`} />
            {workout.cardio.distance != null && (
              <CardioStat icon={Route} label="Distance" value={`${workout.cardio.distance} mi`} />
            )}
            {workout.cardio.heartRate != null && (
              <CardioStat icon={Heart} label="Avg HR" value={`${workout.cardio.heartRate} bpm`} />
            )}
            <CardioStat icon={Flame} label="Burned" value={`${workout.cardio.caloriesBurned} cal`} />
          </div>
        )}

        {workout.type === "rest" && (
          <p className="mt-3 text-sm text-muted-foreground">
            Recovery day. Stretch and stay hydrated.
          </p>
        )}
      </div>

      {/* Weekly overview */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground/70">
          This Week
        </h3>
        <div className="flex items-center justify-between gap-1 rounded-lg border border-border bg-card/30 px-4 py-3">
          {weekOverview.map((day) => (
            <div key={day.date} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/60">
                {day.label}
              </span>
              <WeekDot status={day.status} color={color} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, color }: { status: string; color: string }) {
  if (status === "completed") {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ backgroundColor: `${color}20`, color }}
      >
        Done
      </span>
    );
  }
  if (status === "scheduled") {
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        Scheduled
      </span>
    );
  }
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Rest
    </span>
  );
}

function CardioStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[10px] text-muted-foreground/60">{label}</span>
      </div>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function WeekDot({ status, color }: { status: string; color: string }) {
  if (status === "completed") {
    return (
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    );
  }
  if (status === "scheduled") {
    return (
      <div
        className="h-2.5 w-2.5 rounded-full border-[1.5px]"
        style={{ borderColor: color }}
      />
    );
  }
  return (
    <div className="h-2.5 w-2.5 rounded-full bg-secondary" />
  );
}
