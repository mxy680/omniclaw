"use client";

import {
  Play,
  CheckCircle2,
  Trash2,
  GitBranch,
  AlertCircle,
  Zap,
  FolderGit2,
} from "lucide-react";
import type { WsTask } from "@/lib/websocket";
import { getStatusColor } from "./status-filter";

interface TaskCardProps {
  task: WsTask;
  onApprove: () => void;
  onExecute: () => void;
  onDelete: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "#71717a",
  medium: "#a1a1aa",
  high: "#f59e0b",
  critical: "#ef4444",
};

export function TaskCard({ task, onApprove, onExecute, onDelete }: TaskCardProps) {
  const statusColor = getStatusColor(task.status);
  const isRunning = task.status === "in_progress" || task.status === "testing";
  const isSelf = !task.target || task.target === "self";
  const priorityColor = PRIORITY_COLORS[task.priority] ?? "#a1a1aa";

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border bg-card/60 p-5 transition-all hover:border-foreground/15 hover:bg-card/80"
      style={{ borderLeftColor: statusColor, borderLeftWidth: 3 }}
    >
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-[0.06] blur-2xl transition-opacity group-hover:opacity-[0.12]"
        style={{ backgroundColor: statusColor }}
      />

      {/* Delete button — top-right, visible on hover */}
      {!isRunning && (
        <button
          onClick={onDelete}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/40 hover:!bg-red-500/10 hover:!text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Top row: status + priority */}
      <div className="flex items-center gap-2 pr-6">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isRunning ? "animate-pulse" : ""}`}
            style={{ backgroundColor: statusColor }}
          />
          {task.status.replace("_", " ")}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
          style={{ backgroundColor: `${priorityColor}12`, color: priorityColor }}
        >
          {task.priority}
        </span>
      </div>

      {/* Title */}
      <h3 className="mt-3.5 text-[15px] font-semibold leading-snug tracking-tight">
        {task.title}
      </h3>

      {/* Description */}
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {task.description}
      </p>

      {/* Meta chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
          {isSelf ? (
            <Zap className="h-3 w-3 text-amber-400/70" />
          ) : (
            <FolderGit2 className="h-3 w-3" />
          )}
          {isSelf ? "Self-evolution" : task.target}
        </span>
        {task.branch && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] font-mono text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            {task.branch.split("/").pop()}
          </span>
        )}
      </div>

      {/* Error */}
      {task.error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2.5 text-xs leading-relaxed text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-3">{task.error}</span>
        </div>
      )}

      {/* Actions */}
      {(task.status === "proposed" || task.status === "approved") && (
        <div className="mt-4 flex items-center gap-2">
          {task.status === "proposed" && (
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3.5 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/25"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </button>
          )}
          {task.status === "approved" && (
            <button
              onClick={onExecute}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3.5 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25"
            >
              <Play className="h-3.5 w-3.5" />
              Execute
            </button>
          )}
        </div>
      )}
    </div>
  );
}
