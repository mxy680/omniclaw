import type { TaskRow } from "./task-store.js";

/** Task as sent over the wire (camelCase). */
export type WsTask = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  target: string | null;
  branch: string | null;
  sessionId: string | null;
  error: string | null;
  costUsd: number | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};

/** Convert a DB row (snake_case) to wire format (camelCase). */
export function toWsTask(row: TaskRow): WsTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    source: row.source,
    target: row.target,
    branch: row.branch,
    sessionId: row.session_id,
    error: row.error,
    costUsd: row.cost_usd,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}
