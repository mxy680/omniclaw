import { integrations } from "@/lib/integrations";
import type { SectionIntegration } from "@/lib/sections";

function capitalize(s: string): string {
  return s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface IntegrationStatusCardProps {
  integration: SectionIntegration;
}

export function IntegrationStatusCard({ integration }: IntegrationStatusCardProps) {
  const meta = integrations.find((i) => i.id === integration.id);
  const name = meta?.name ?? capitalize(integration.id);
  const Icon = meta?.icon;
  const color = meta?.color ?? "#888";
  const toolCount = meta?.tools.length ?? 0;
  const isActive = integration.status === "active";

  return (
    <div className="rounded-lg border border-border p-4 transition-colors hover:border-foreground/15">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {Icon ? (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}18` }}
            >
              <Icon className="h-4.5 w-4.5" style={{ color }} />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <span className="text-xs font-medium text-muted-foreground">
                {name.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium">{name}</p>
            {isActive && toolCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {toolCount} tool{toolCount !== 1 && "s"}
              </p>
            )}
          </div>
        </div>
        {isActive ? (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-muted-foreground">Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            <span className="text-[10px] text-muted-foreground">Planned</span>
            {integration.issueNumber && (
              <a
                href={`https://github.com/mxy680/omniclaw/issues/${integration.issueNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                #{integration.issueNumber}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
