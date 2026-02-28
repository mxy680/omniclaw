import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";

// ── Types ───────────────────────────────────────────────────────────

export type TaskStatus =
  | "proposed"
  | "approved"
  | "in_progress"
  | "testing"
  | "completed"
  | "failed";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  source: string;
  target: string | null;
  branch: string | null;
  session_id: string | null;
  error: string | null;
  cost_usd: number | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export interface TaskFilter {
  status?: TaskStatus;
}

// ── Store ───────────────────────────────────────────────────────────

export class TaskStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dir = join(homedir(), ".openclaw");
    mkdirSync(dir, { recursive: true });
    const path = dbPath ?? join(dir, "omniclaw-tasks.db");

    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  // ── Schema ──────────────────────────────────────────────────────

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id           TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        description  TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'proposed',
        priority     TEXT NOT NULL DEFAULT 'medium',
        source       TEXT NOT NULL,
        target       TEXT,
        branch       TEXT,
        session_id   TEXT,
        error        TEXT,
        cost_usd     REAL,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at DESC);
    `);
  }

  // ── CRUD ────────────────────────────────────────────────────────

  listTasks(filter?: TaskFilter): TaskRow[] {
    if (filter?.status) {
      return this.db
        .prepare("SELECT * FROM tasks WHERE status = ? ORDER BY updated_at DESC")
        .all(filter.status) as TaskRow[];
    }
    return this.db
      .prepare("SELECT * FROM tasks ORDER BY updated_at DESC")
      .all() as TaskRow[];
  }

  getTask(id: string): TaskRow | undefined {
    return this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(id) as TaskRow | undefined;
  }

  createTask(
    id: string,
    title: string,
    description: string,
    opts?: {
      priority?: TaskPriority;
      source?: string;
      target?: string;
    },
  ): TaskRow {
    const now = Date.now();
    const source = opts?.source ?? "agent";
    const priority = opts?.priority ?? "medium";
    const target = opts?.target ?? null;

    this.db
      .prepare(
        `INSERT INTO tasks (id, title, description, status, priority, source, target, created_at, updated_at)
         VALUES (?, ?, ?, 'proposed', ?, ?, ?, ?, ?)`,
      )
      .run(id, title, description, priority, source, target, now, now);

    return {
      id,
      title,
      description,
      status: "proposed",
      priority,
      source,
      target,
      branch: null,
      session_id: null,
      error: null,
      cost_usd: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
    };
  }

  updateTask(
    id: string,
    fields: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      branch?: string;
      session_id?: string;
      error?: string | null;
      cost_usd?: number;
      completed_at?: number;
    },
  ): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.title !== undefined) {
      sets.push("title = ?");
      values.push(fields.title);
    }
    if (fields.description !== undefined) {
      sets.push("description = ?");
      values.push(fields.description);
    }
    if (fields.status !== undefined) {
      sets.push("status = ?");
      values.push(fields.status);
    }
    if (fields.priority !== undefined) {
      sets.push("priority = ?");
      values.push(fields.priority);
    }
    if (fields.branch !== undefined) {
      sets.push("branch = ?");
      values.push(fields.branch);
    }
    if (fields.session_id !== undefined) {
      sets.push("session_id = ?");
      values.push(fields.session_id);
    }
    if (fields.error !== undefined) {
      sets.push("error = ?");
      values.push(fields.error);
    }
    if (fields.cost_usd !== undefined) {
      sets.push("cost_usd = ?");
      values.push(fields.cost_usd);
    }
    if (fields.completed_at !== undefined) {
      sets.push("completed_at = ?");
      values.push(fields.completed_at);
    }

    if (sets.length === 0) return;

    sets.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);

    this.db
      .prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  deleteTask(id: string): void {
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
