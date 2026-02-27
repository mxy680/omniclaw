"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { DailyNutrition } from "@/lib/fitness-data";

interface MacroRatioRingProps {
  nutrition: DailyNutrition;
}

const MACROS = [
  { key: "protein" as const, label: "Protein", color: "#3b82f6", calsPerGram: 4 },
  { key: "carbs" as const, label: "Carbs", color: "#eab308", calsPerGram: 4 },
  { key: "fat" as const, label: "Fat", color: "#a855f7", calsPerGram: 9 },
];

export function MacroRatioRing({ nutrition }: MacroRatioRingProps) {
  const data = MACROS.map((m) => ({
    name: m.label,
    value: nutrition[m.key].current * m.calsPerGram,
    grams: nutrition[m.key].current,
    color: m.color,
  }));

  const totalCals = data.reduce((s, d) => s + d.value, 0);

  const pcts = data.map((d) => ({
    ...d,
    pct: totalCals > 0 ? Math.round((d.value / totalCals) * 100) : 0,
  }));

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Macro Ratio
      </h2>

      <div className="mt-4 flex items-center gap-6">
        {/* Ring chart */}
        <div className="relative h-28 w-28 shrink-0">
          {totalCals > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pcts}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={52}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {pcts.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ value: 1 }]}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={52}
                  strokeWidth={0}
                >
                  <Cell fill="hsl(var(--muted))" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-semibold tabular-nums">
              {totalCals > 0 ? totalCals.toLocaleString() : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground">kcal</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2.5">
          {pcts.map((d) => (
            <div key={d.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-sm">{d.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {d.grams}g
                </span>
                <span className="w-8 text-right text-xs font-medium tabular-nums">
                  {d.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
