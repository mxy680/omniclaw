import Link from "next/link";
import type { SectionStatus } from "@/lib/sections";

interface BentoCardProps {
  id: string;
  title: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  status: SectionStatus;
  metrics: { label: string; value: string | null }[];
}

const statusLabel: Record<SectionStatus, string> = {
  live: "Live",
  partial: "Partial",
  "coming-soon": "Coming Soon",
};

const statusDot: Record<SectionStatus, string> = {
  live: "bg-emerald-500",
  partial: "bg-amber-400",
  "coming-soon": "bg-zinc-500",
};

export function BentoCard({
  id,
  title,
  tagline,
  icon: Icon,
  color,
  status,
  metrics,
}: BentoCardProps) {
  const preview = metrics.slice(0, 3);

  return (
    <Link
      href={`/${id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card/60 p-5 transition-all hover:border-foreground/15 hover:bg-card/80"
    >
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.12]"
        style={{ backgroundColor: color }}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status]}`} />
          <span className="text-[10px] text-muted-foreground">
            {statusLabel[status]}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="mt-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{tagline}</p>
      </div>

      {/* Preview metrics */}
      <div className="mt-4 flex gap-4">
        {preview.map((m) => (
          <div key={m.label} className="min-w-0">
            <p className="text-[10px] text-muted-foreground/60 truncate">
              {m.label}
            </p>
            <p className="text-sm font-medium">
              {m.value ?? (
                <span className="text-muted-foreground/30">&mdash;</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </Link>
  );
}
