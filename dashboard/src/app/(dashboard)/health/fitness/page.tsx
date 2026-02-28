"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { DateNavigator } from "@/components/fitness/date-navigator";
import { WorkoutStatsBar } from "@/components/workout/workout-stats-bar";
import { ExerciseTimeline } from "@/components/workout/exercise-timeline";
import { WeekActivityCard } from "@/components/workout/week-activity-card";
import { WorkoutSummaryCard } from "@/components/workout/workout-summary-card";
import { useWorkout } from "@/hooks/use-workout";

const COLOR = "#f97316";

export default function FitnessPage() {
  const [date, setDate] = useState(new Date());
  const { workout, loading } = useWorkout(date);

  const shiftDate = (days: number) => {
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header + date nav */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          icon={Dumbbell}
          color={COLOR}
          title="Fitness"
          tagline="Workouts and training"
        />
        <DateNavigator
          date={date}
          onPrev={() => shiftDate(-1)}
          onNext={() => shiftDate(1)}
        />
      </div>

      {loading || !workout ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {loading ? "Loading..." : "No data for this date"}
        </div>
      ) : (
        <>
          <WorkoutStatsBar workout={workout.workout} color={COLOR} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: Exercise breakdown */}
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
Planned Workout
              </h2>
              <ExerciseTimeline workout={workout.workout} workoutPlan={workout.workoutPlan} color={COLOR} />
            </div>

            {/* Right: Week activity + Workout summary stacked */}
            <div className="space-y-6">
              <WeekActivityCard
                weekOverview={workout.weekOverview}
                color={COLOR}
              />
              <WorkoutSummaryCard workout={workout.workout} workoutPlan={workout.workoutPlan} color={COLOR} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
