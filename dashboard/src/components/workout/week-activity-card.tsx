import type { WeekDay } from "@/lib/fitness-data";

interface WeekActivityCardProps {
  weekOverview: WeekDay[];
  color: string;
}

export function WeekActivityCard({ weekOverview, color }: WeekActivityCardProps) {
  const activeDays = weekOverview.filter(
    (d) => d.status === "completed",
  ).length;

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          This Week
        </h2>
        <span className="text-xs text-muted-foreground">
          {activeDays}/7 days active
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-1 rounded-lg bg-muted/20 px-4 py-3">
        {weekOverview.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/60">
              {day.label}
            </span>
            <WeekDot status={day.status} color={color} />
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekDot({ status, color }: { status: string; color: string }) {
  if (status === "completed") {
    return (
      <div
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
    );
  }
  if (status === "scheduled") {
    return (
      <div
        className="h-3 w-3 rounded-full border-[1.5px]"
        style={{ borderColor: color }}
      />
    );
  }
  return <div className="h-3 w-3 rounded-full bg-secondary" />;
}
