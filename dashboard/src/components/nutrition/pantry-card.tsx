"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import type { PantryItem } from "@/lib/fitness-data";

interface PantryCardProps {
  items: PantryItem[];
  color: string;
}

export function PantryCard({ items, color }: PantryCardProps) {
  const categories = Array.from(new Set(items.map((i) => i.category))).sort();
  const [active, setActive] = useState<string | null>(null);

  const filtered = active ? items.filter((i) => i.category === active) : items;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pantry
        </h2>
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          No pantry items
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pantry
        </h2>
        <span className="text-xs text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Category chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setActive(null)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
            active === null
              ? "text-foreground"
              : "bg-muted/30 text-muted-foreground hover:text-foreground"
          }`}
          style={active === null ? { backgroundColor: color + "20", color } : undefined}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActive(active === cat ? null : cat)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
              active === cat
                ? "text-foreground"
                : "bg-muted/30 text-muted-foreground hover:text-foreground"
            }`}
            style={active === cat ? { backgroundColor: color + "20", color } : undefined}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2.5 rounded-lg border border-border bg-card/30 px-3 py-2.5"
          >
            <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {item.quantity} {item.unit}
                </span>
              </div>
              {item.caloriesPerServing != null && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.caloriesPerServing} kcal
                  {item.proteinPerServing != null && (
                    <span className="ml-1.5">
                      P{item.proteinPerServing} C{item.carbsPerServing ?? 0} F{item.fatPerServing ?? 0}
                    </span>
                  )}
                  {item.servingSize && (
                    <span className="ml-1 text-muted-foreground/60">
                      / {item.servingSize}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
