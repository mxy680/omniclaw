"use client";

import { SectionHeader } from "@/components/section-header";
import { Apple } from "lucide-react";

export default function NutritionPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionHeader
        icon={Apple}
        color="#f97316"
        title="Nutrition"
        tagline="Food diary, macros, and meal planning"
      />
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading...
      </div>
    </div>
  );
}
