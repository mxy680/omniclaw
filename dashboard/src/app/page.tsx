"use client";

import { BentoCard } from "@/components/bento-card";
import { sections } from "@/lib/sections";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {getGreeting()}, Mark
        </h1>
        <p className="text-sm text-muted-foreground">{formatDate()}</p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <BentoCard
            key={section.id}
            id={section.id}
            title={section.title}
            tagline={section.tagline}
            icon={section.icon}
            color={section.color}
            status={section.status}
            metrics={section.metrics}
          />
        ))}
      </div>
    </div>
  );
}
