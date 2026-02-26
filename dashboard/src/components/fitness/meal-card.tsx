"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Meal } from "@/lib/fitness-data";

interface MealCardProps {
  meal: Meal;
}

export function MealCard({ meal }: MealCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
      >
        <span className="text-sm font-medium">{meal.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {meal.totalCalories} cal
          </span>
          <ChevronRight
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-3 pb-2.5 pt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground/60">
                <th className="pb-1 text-left font-normal">Item</th>
                <th className="pb-1 text-right font-normal">Cal</th>
                <th className="pb-1 text-right font-normal">P</th>
                <th className="pb-1 text-right font-normal">C</th>
                <th className="pb-1 text-right font-normal">F</th>
              </tr>
            </thead>
            <tbody>
              {meal.items.map((item) => (
                <tr key={item.name} className="text-muted-foreground">
                  <td className="py-0.5 text-foreground/80">{item.name}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {item.calories}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">
                    {item.protein}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">
                    {item.carbs}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">
                    {item.fat}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
