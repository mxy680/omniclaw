"use client";

import { useState, useMemo } from "react";
import { Activity, Loader2, Check, Search } from "lucide-react";
import { useOperations, type Operation } from "@/hooks/use-operations";
import {
  findIntegrationForTool,
  findToolByName,
} from "@/lib/integrations";

// ── Helpers ─────────────────────────────────────────────────────────

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

// ── Components ──────────────────────────────────────────────────────

function OperationRow({ operation }: { operation: Operation }) {
  const integration = findIntegrationForTool(operation.toolName);
  const tool = findToolByName(operation.toolName);
  const Icon = integration?.icon ?? Activity;
  const color = integration?.color ?? "#888";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-foreground/15">
      {/* Icon */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {tool?.label ?? operation.toolName}
          </span>
          {integration && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${color}20`,
                color,
              }}
            >
              {integration.name}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {operation.conversationTitle}
        </p>
      </div>

      {/* Timestamp + status */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {timeAgo(operation.timestamp)}
        </span>
        {operation.phase === "start" ? (
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export default function OperationsPage() {
  const { operations } = useOperations();
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    const lowerFilter = filter.toLowerCase();
    const filtered = lowerFilter
      ? operations.filter((op) => {
          const integration = findIntegrationForTool(op.toolName);
          const tool = findToolByName(op.toolName);
          return (
            op.toolName.toLowerCase().includes(lowerFilter) ||
            (tool?.label ?? "").toLowerCase().includes(lowerFilter) ||
            (integration?.name ?? "").toLowerCase().includes(lowerFilter) ||
            op.conversationTitle.toLowerCase().includes(lowerFilter)
          );
        })
      : operations;

    return [...filtered].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [operations, filter]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
          <p className="text-sm text-muted-foreground">
            {operations.length} tool execution{operations.length !== 1 && "s"}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by tool, integration, or conversation..."
          className="w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/40 focus:border-foreground/20 transition-colors"
        />
      </div>

      {/* Feed */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Activity className="h-8 w-8 text-muted-foreground/20" />
          <p className="mt-3 text-sm text-muted-foreground/50">
            {filter
              ? "No operations match your filter"
              : "No tool executions yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((op, i) => (
            <OperationRow key={`${op.id}-${i}`} operation={op} />
          ))}
        </div>
      )}
    </div>
  );
}
