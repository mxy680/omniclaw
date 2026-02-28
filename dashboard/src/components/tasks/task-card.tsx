"use client";

import {
  Play,
  CheckCircle2,
  Trash2,
  GitBranch,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import type { WsTask } from "@/lib/websocket";
import { getStatusColor } from "./status-filter";

interface TaskCardProps {
  task: WsTask;
  onApprove: () => void;
  onExecute: () => void;
  onDelete: () => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
  critical: "Crit",
};

export function TaskCard({ task, onApprove, onExecute, onDelete }: TaskCardProps) {
  const statusColor = getStatusColor(task.status);
  const isRunning = task.status === "in_progress" || task.status === "testing";

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5 transition-colors hover:bg-card/60">
      {/* Header: status badge + priority */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isRunning ? "animate-pulse" : ""}`}
            style={{ backgroundColor: statusColor }}
          />
          {task.status.replace("_", " ")}
        </span>
        <span className="text-[10px] font-medium uppercase text-muted-foreground">
          {PRIORITY_LABELS[task.priority] ?? task.priority}
        </span>
      </div>

      {/* Title + description */}
      <h3 className="mt-3 text-sm font-semibold leading-snug">{task.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {task.description}
      </p>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span>{task.target === "self" ? "Self-evolution" : task.target ?? "self"}</span>
        {task.branch && (
          <span className="inline-flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {task.branch.split("/").pop()}
          </span>
        )}
        {task.costUsd != null && (
          <span className="inline-flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ${task.costUsd.toFixed(2)}
          </span>
        )}
      </div>

      {/* Error */}
      {task.error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-3">{task.error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {task.status === "proposed" && (
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/25"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approve
          </button>
        )}
        {task.status === "approved" && (
          <button
            onClick={onExecute}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/25"
          >
            <Play className="h-3.5 w-3.5" />
            Execute
          </button>
        )}
        {!isRunning && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
