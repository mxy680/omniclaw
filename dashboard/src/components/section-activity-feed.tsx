"use client";

import { useMemo } from "react";
import { Activity, Loader2, Check } from "lucide-react";
import { useOperations } from "@/hooks/use-operations";
import { findIntegrationForTool, findToolByName } from "@/lib/integrations";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface SectionActivityFeedProps {
  integrationIds: string[];
}

export function SectionActivityFeed({ integrationIds }: SectionActivityFeedProps) {
  const { operations } = useOperations();

  const filtered = useMemo(() => {
    const idSet = new Set(integrationIds);
    return operations
      .filter((op) => {
        const integration = findIntegrationForTool(op.toolName);
        return integration && idSet.has(integration.id);
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 20);
  }, [operations, integrationIds]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border py-12">
        <Activity className="h-6 w-6 text-muted-foreground/20" />
        <p className="mt-2 text-xs text-muted-foreground/50">
          No activity yet — use Chat to interact with these integrations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((op) => {
        const integration = findIntegrationForTool(op.toolName);
        const tool = findToolByName(op.toolName);
        const Icon = integration?.icon ?? Activity;
        const color = integration?.color ?? "#888";

        return (
          <div
            key={op.id}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-foreground/15"
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${color}18` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">
                {tool?.label ?? op.toolName}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {timeAgo(op.timestamp)}
              </span>
              {op.phase === "start" ? (
                <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
              ) : (
                <Check className="h-3 w-3 text-emerald-500" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
