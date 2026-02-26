import type { FitnessDay } from "@/lib/fitness-data";
import { WeightChart } from "./weight-chart";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface BodyColumnProps {
  body: FitnessDay["body"];
  color: string;
}

export function BodyColumn({ body, color }: BodyColumnProps) {
  const { latest, weightDelta, bodyFatDelta, goalWeight, trend, recentReadings } = body;

  return (
    <div className="space-y-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Body Composition
      </h2>

      {/* Current stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox
          label="Weight"
          value={`${latest.weight} lb`}
          delta={weightDelta}
          unit="lb"
        />
        <StatBox
          label="Body Fat"
          value={`${latest.bodyFat}%`}
          delta={bodyFatDelta}
          unit="%"
        />
        <StatBox label="Lean Mass" value={`${latest.leanMass} lb`} />
        <StatBox label="BMI" value={`${latest.bmi}`} />
      </div>

      {/* Weight trend chart */}
      <WeightChart trend={trend} goalWeight={goalWeight} color={color} />

      {/* Recent readings */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground/70">
          Recent Readings
        </h3>
        <div className="space-y-1">
          {recentReadings.map((r) => (
            <div
              key={r.date}
              className="flex items-center justify-between rounded-md px-3 py-1.5 text-xs odd:bg-card/30"
            >
              <span className="text-muted-foreground">{r.date}</span>
              <div className="flex gap-4 tabular-nums">
                <span>{r.weight} lb</span>
                <span className="text-muted-foreground">{r.bodyFat}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  delta,
  unit,
}: {
  label: string;
  value: string;
  delta?: number;
  unit?: string;
}) {
  const DeltaIcon =
    delta != null && delta !== 0
      ? delta < 0
        ? TrendingDown
        : TrendingUp
      : Minus;

  return (
    <div className="rounded-lg border border-border bg-card/30 px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground/60">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
      {delta != null && delta !== 0 && (
        <div className="mt-0.5 flex items-center gap-1">
          <DeltaIcon className={`h-3 w-3 ${delta < 0 ? "text-green-400" : "text-red-400"}`} />
          <span
            className={`text-[10px] tabular-nums ${delta < 0 ? "text-green-400" : "text-red-400"}`}
          >
            {delta > 0 ? "+" : ""}
            {delta} {unit}
          </span>
        </div>
      )}
    </div>
  );
}
