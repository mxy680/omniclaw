import type { MacroTarget } from "@/lib/fitness-data";

interface MacroProgressBarProps {
  label: string;
  macro: MacroTarget;
  color: string;
}

export function MacroProgressBar({ label, macro, color }: MacroProgressBarProps) {
  const pct = Math.min((macro.current / macro.target) * 100, 100);
  const over = macro.current > macro.target;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {macro.current.toLocaleString()}
          <span className="text-muted-foreground/50">
            {" "}/ {macro.target.toLocaleString()}{macro.unit !== "kcal" ? macro.unit : ""}
          </span>
          {over && (
            <span className="ml-1 text-red-400">over</span>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: over ? "#ef4444" : color,
          }}
        />
      </div>
    </div>
  );
}
