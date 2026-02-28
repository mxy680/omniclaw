"use client";

const STATUSES = [
  { value: "all", label: "All" },
  { value: "proposed", label: "Proposed", color: "#71717a" },
  { value: "approved", label: "Approved", color: "#3b82f6" },
  { value: "in_progress", label: "In Progress", color: "#eab308" },
  { value: "testing", label: "Testing", color: "#a855f7" },
  { value: "completed", label: "Completed", color: "#22c55e" },
  { value: "failed", label: "Failed", color: "#ef4444" },
] as const;

interface StatusFilterProps {
  value: string;
  onChange: (status: string) => void;
  counts: Record<string, number>;
}

export function StatusFilter({ value, onChange, counts }: StatusFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s) => {
        const count = s.value === "all"
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[s.value] ?? 0);
        const isActive = value === s.value;

        return (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "bg-white/10 text-white"
                : "bg-transparent text-muted-foreground hover:text-white/80"
            }`}
            style={
              isActive && s.value !== "all"
                ? { backgroundColor: `${s.color}20`, color: s.color }
                : undefined
            }
          >
            {s.value !== "all" && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
            )}
            {s.label}
            <span className="text-[10px] opacity-60">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function getStatusColor(status: string): string {
  const found = STATUSES.find((s) => s.value === status);
  return (found && "color" in found ? found.color : undefined) ?? "#71717a";
}
