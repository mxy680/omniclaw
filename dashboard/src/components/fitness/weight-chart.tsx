"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { WeightTrendPoint } from "@/lib/fitness-data";

interface WeightChartProps {
  trend: WeightTrendPoint[];
  goalWeight: number;
  color: string;
}

type Range = "7d" | "30d";

export function WeightChart({ trend, goalWeight, color }: WeightChartProps) {
  const [range, setRange] = useState<Range>("30d");
  const data = range === "7d" ? trend.slice(-7) : trend;

  const weights = data.map((p) => p.weight);
  const min = Math.min(...weights, goalWeight);
  const max = Math.max(...weights, goalWeight);
  const padding = (max - min) * 0.3 || 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground/70">
          Weight Trend
        </h3>
        <div className="flex gap-1">
          {(["7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                range === r
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#27272a"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              interval={range === "7d" ? 0 : "preserveStartEnd"}
            />
            <YAxis
              domain={[Math.floor(min - padding), Math.ceil(max + padding)]}
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#fafafa",
              }}
              formatter={(value) => [`${value} lb`, "Weight"]}
            />
            <ReferenceLine
              y={goalWeight}
              stroke="#22c55e"
              strokeDasharray="6 3"
              strokeWidth={1}
              label={{
                value: `Goal: ${goalWeight}`,
                position: "insideTopRight",
                fill: "#22c55e",
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: "#09090b", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
