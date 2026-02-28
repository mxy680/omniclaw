"use client";

import { useState } from "react";
import {
  Clock,
  Wrench,
  MessageSquare,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { WsJob, WsJobRun } from "@/lib/websocket";
import { cronToHuman } from "./cron-human";

interface JobCardProps {
  job: WsJob;
  runs?: WsJobRun[];
  onToggle: () => void;
  onExpand: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  success: "#22c55e",
  error: "#ef4444",
  running: "#eab308",
};

function formatRelativeTime(epochMs: number): string {
  const now = Date.now();
  const diff = epochMs - now;
  const absDiff = Math.abs(diff);

  if (absDiff < 60_000) return diff > 0 ? "in <1m" : "<1m ago";

  const minutes = Math.floor(absDiff / 60_000);
  if (minutes < 60) return diff > 0 ? `in ${minutes}m` : `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return diff > 0 ? `in ${hours}h` : `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return diff > 0 ? `in ${days}d` : `${days}d ago`;
}

function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RunStatusIcon({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#71717a";
  if (status === "running") return <Loader2 className="h-3 w-3 animate-spin" style={{ color }} />;
  if (status === "success") return <CheckCircle2 className="h-3 w-3" style={{ color }} />;
  if (status === "error") return <XCircle className="h-3 w-3" style={{ color }} />;
  return <Clock className="h-3 w-3" style={{ color }} />;
}

export function JobCard({ job, runs, onToggle, onExpand }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = job.enabled ? "#22c55e" : "#71717a";
  const ModeIcon = job.mode === "tool" ? Wrench : MessageSquare;

  const handleExpand = () => {
    if (!expanded && !runs) {
      onExpand();
    }
    setExpanded(!expanded);
  };

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border bg-card/60 p-5 transition-all hover:border-foreground/15 hover:bg-card/80"
      style={{ borderLeftColor: borderColor, borderLeftWidth: 3 }}
    >
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-[0.06] blur-2xl transition-opacity group-hover:opacity-[0.12]"
        style={{ backgroundColor: borderColor }}
      />

      {/* Toggle — top-right */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={job.enabled}
        aria-label={job.enabled ? "Disable job" : "Enable job"}
        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        {job.enabled ? (
          <ToggleRight className="h-5 w-5 text-emerald-400" />
        ) : (
          <ToggleLeft className="h-5 w-5" />
        )}
      </button>

      {/* Top row: enabled badge + mode badge */}
      <div className="flex items-center gap-2 pr-8">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: `${borderColor}15`,
            color: borderColor,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: borderColor }}
          />
          {job.enabled ? "Enabled" : "Disabled"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <ModeIcon className="h-2.5 w-2.5" />
          {job.mode}
        </span>
      </div>

      {/* Title */}
      <h3 className="mt-3.5 text-[15px] font-semibold leading-snug tracking-tight">
        {job.name}
      </h3>

      {/* Schedule */}
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {cronToHuman(job.cron)}
        <span className="ml-1 opacity-60">({job.timezone})</span>
      </p>

      {/* Meta chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Next: {formatRelativeTime(job.nextRunAt)}
        </span>
        {job.lastRunAt && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
            <RunStatusIcon status={job.lastStatus ?? "unknown"} />
            Last: {formatRelativeTime(job.lastRunAt)}
          </span>
        )}
        {job.mode === "tool" && job.toolName && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] font-mono text-muted-foreground">
            <Wrench className="h-3 w-3" />
            {job.toolName}
          </span>
        )}
      </div>

      {/* Expand button */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={handleExpand}
        className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
        {expanded ? "Hide" : "Show"} run history
      </button>

      {/* Expandable run history */}
      {expanded && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {!runs ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading runs...
            </div>
          ) : runs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No runs yet</p>
          ) : (
            runs.map((run) => (
              <div
                key={run.id}
                className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-[11px]"
              >
                <RunStatusIcon status={run.status} />
                <span className="font-medium" style={{ color: STATUS_COLORS[run.status] ?? "#a1a1aa" }}>
                  {run.status}
                </span>
                <span className="text-muted-foreground">
                  {formatTimestamp(run.startedAt)}
                </span>
                {run.completedAt && (
                  <span className="ml-auto text-muted-foreground/60">
                    {Math.round((run.completedAt - run.startedAt) / 1000)}s
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
