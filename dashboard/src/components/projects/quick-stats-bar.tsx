import { FolderKanban, Link, Layers } from "lucide-react";

interface ProjectStats {
  totalProjects: number;
  totalLinks: number;
  platforms: number;
}

interface QuickStatsBarProps {
  stats: ProjectStats;
  color: string;
}

export function QuickStatsBar({ stats, color }: QuickStatsBarProps) {
  const items = [
    {
      icon: FolderKanban,
      label: "Projects",
      value: `${stats.totalProjects}`,
    },
    {
      icon: Link,
      label: "Linked Services",
      value: `${stats.totalLinks}`,
    },
    {
      icon: Layers,
      label: "Platforms",
      value: `${stats.platforms}`,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-border bg-card/50 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <s.icon className="h-3.5 w-3.5" style={{ color }} />
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
          <div className="mt-1">
            <span className="text-lg font-semibold tracking-tight">
              {s.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
