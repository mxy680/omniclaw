"use client";

import { SectionHeader } from "@/components/section-header";
import { Dumbbell } from "lucide-react";

export default function FitnessPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionHeader
        icon={Dumbbell}
        color="#f97316"
        title="Fitness"
        tagline="Workouts and body metrics"
      />
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Coming soon
      </div>
    </div>
  );
}
