"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateNavigatorProps {
  date: Date;
  onPrev: () => void;
  onNext: () => void;
}

export function DateNavigator({ date, onPrev, onNext }: DateNavigatorProps) {
  const isToday =
    date.toDateString() === new Date().toDateString();

  const label = isToday
    ? `Today, ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPrev}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[140px] text-center text-sm font-medium">
        {label}
      </span>
      <button
        onClick={onNext}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
