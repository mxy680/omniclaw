"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/section-header";
import { DateNavigator } from "@/components/fitness/date-navigator";
import { QuickStatsBar } from "@/components/fitness/quick-stats-bar";
import { NutritionColumn } from "@/components/fitness/nutrition-column";
import { WorkoutColumn } from "@/components/fitness/workout-column";
import { BodyColumn } from "@/components/fitness/body-column";
import { getSection } from "@/lib/sections";
import { useFitness } from "@/hooks/use-fitness";

const section = getSection("fitness")!;

export default function FitnessPage() {
  const [date, setDate] = useState(new Date());

  const { data, loading } = useFitness(date);

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
          icon={section.icon}
          color={section.color}
          title={section.title}
          tagline={section.tagline}
        />
        <DateNavigator
          date={date}
          onPrev={() => shiftDate(-1)}
          onNext={() => shiftDate(1)}
        />
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {loading ? "Loading..." : "No data for this date"}
        </div>
      ) : (
        <>
          {/* Quick stats */}
          <QuickStatsBar data={data} color={section.color} />

          {/* Three-column grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <NutritionColumn nutrition={data.nutrition} color={section.color} />
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <WorkoutColumn
                workout={data.workout}
                weekOverview={data.weekOverview}
                color={section.color}
              />
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5 md:col-span-2 lg:col-span-1">
              <BodyColumn body={data.body} color={section.color} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
