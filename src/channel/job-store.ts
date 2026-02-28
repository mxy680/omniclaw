import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";
import { randomUUID } from "crypto";
import { Cron } from "croner";

// ── Types ───────────────────────────────────────────────────────────

export type JobMode = "tool" | "agent";
export type JobRunStatus = "running" | "success" | "error";

export interface JobRow {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  mode: JobMode;
  tool_name: string | null;
  tool_params: string | null;
  prompt: string | null;
  /** SQLite stores booleans as 0/1 */
  enabled: number;
  next_run_at: number;
  last_run_at: number | null;
  last_status: JobRunStatus | null;
  created_at: number;
  updated_at: number;
}

export interface JobRunRow {
  id: string;
  job_id: string;
  started_at: number;
  completed_at: number | null;
  status: JobRunStatus;
  result: string | null;
}

export interface JobFilter {
  enabled?: boolean;
}

export interface CreateJobInput {
  name: string;
  cron: string;
  timezone: string;
  mode: JobMode;
  tool_name?: string;
  tool_params?: string;
  prompt?: string;
}

// ── Helper ──────────────────────────────────────────────────────────

/**
 * Compute the next scheduled run time for a cron expression in epoch ms.
 * Exported so JobScheduler can reuse the same logic.
 */
export function computeNextRun(cronExpr: string, timezone: string): number {
  const c = new Cron(cronExpr, { timezone });
  const next = c.nextRun();
  if (!next) {
    throw new Error(`Cron expression "${cronExpr}" has no future occurrences`);
  }
  return next.getTime();
}

// ── Store ───────────────────────────────────────────────────────────

export class JobStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dir = join(homedir(), ".openclaw");
    mkdirSync(dir, { recursive: true });
    const path = dbPath ?? join(dir, "omniclaw-jobs.db");

    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  // ── Schema ──────────────────────────────────────────────────────

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        cron         TEXT NOT NULL,
        timezone     TEXT NOT NULL DEFAULT 'UTC',
        mode         TEXT NOT NULL,
        tool_name    TEXT,
        tool_params  TEXT,
        prompt       TEXT,
        enabled      INTEGER NOT NULL DEFAULT 1,
        next_run_at  INTEGER NOT NULL,
        last_run_at  INTEGER,
        last_status  TEXT,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_enabled_next ON jobs(enabled, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_updated ON jobs(updated_at DESC);

      CREATE TABLE IF NOT EXISTS job_runs (
        id           TEXT PRIMARY KEY,
        job_id       TEXT NOT NULL REFERENCES jobs(id),
        started_at   INTEGER NOT NULL,
        completed_at INTEGER,
        status       TEXT NOT NULL DEFAULT 'running',
        result       TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_job_runs_job_id ON job_runs(job_id, started_at DESC);
    `);
  }

  // ── Jobs CRUD ────────────────────────────────────────────────────

  createJob(input: CreateJobInput): JobRow {
    const now = Date.now();
    const id = randomUUID();
    const next_run_at = computeNextRun(input.cron, input.timezone);
    const tool_name = input.tool_name ?? null;
    const tool_params = input.tool_params ?? null;
    const prompt = input.prompt ?? null;

    this.db
      .prepare(
        `INSERT INTO jobs
           (id, name, cron, timezone, mode, tool_name, tool_params, prompt,
            enabled, next_run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.cron,
        input.timezone,
        input.mode,
        tool_name,
        tool_params,
        prompt,
        next_run_at,
        now,
        now,
      );

    return {
      id,
      name: input.name,
      cron: input.cron,
      timezone: input.timezone,
      mode: input.mode,
      tool_name,
      tool_params,
      prompt,
      enabled: 1,
      next_run_at,
      last_run_at: null,
      last_status: null,
      created_at: now,
      updated_at: now,
    };
  }

  getJob(id: string): JobRow | undefined {
    return this.db
      .prepare("SELECT * FROM jobs WHERE id = ?")
      .get(id) as JobRow | undefined;
  }

  listJobs(filter?: JobFilter): JobRow[] {
    if (filter?.enabled !== undefined) {
      const flag = filter.enabled ? 1 : 0;
      return this.db
        .prepare("SELECT * FROM jobs WHERE enabled = ? ORDER BY updated_at DESC")
        .all(flag) as JobRow[];
    }
    return this.db
      .prepare("SELECT * FROM jobs ORDER BY updated_at DESC")
      .all() as JobRow[];
  }

  updateJob(
    id: string,
    fields: {
      name?: string;
      cron?: string;
      timezone?: string;
      mode?: JobMode;
      tool_name?: string | null;
      tool_params?: string | null;
      prompt?: string | null;
      enabled?: boolean;
      next_run_at?: number;
      last_run_at?: number | null;
      last_status?: JobRunStatus | null;
    },
  ): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) {
      sets.push("name = ?");
      values.push(fields.name);
    }
    if (fields.cron !== undefined) {
      sets.push("cron = ?");
      values.push(fields.cron);
    }
    if (fields.timezone !== undefined) {
      sets.push("timezone = ?");
      values.push(fields.timezone);
    }
    if (fields.mode !== undefined) {
      sets.push("mode = ?");
      values.push(fields.mode);
    }
    if (fields.tool_name !== undefined) {
      sets.push("tool_name = ?");
      values.push(fields.tool_name);
    }
    if (fields.tool_params !== undefined) {
      sets.push("tool_params = ?");
      values.push(fields.tool_params);
    }
    if (fields.prompt !== undefined) {
      sets.push("prompt = ?");
      values.push(fields.prompt);
    }
    if (fields.enabled !== undefined) {
      sets.push("enabled = ?");
      values.push(fields.enabled ? 1 : 0);
    }
    if (fields.last_run_at !== undefined) {
      sets.push("last_run_at = ?");
      values.push(fields.last_run_at);
    }
    if (fields.last_status !== undefined) {
      sets.push("last_status = ?");
      values.push(fields.last_status);
    }

    // If cron or timezone changed, recompute next_run_at (unless caller
    // explicitly provided one).
    if (fields.next_run_at !== undefined) {
      sets.push("next_run_at = ?");
      values.push(fields.next_run_at);
    } else if (fields.cron !== undefined || fields.timezone !== undefined) {
      // Fetch current values to fill in whichever side wasn't changed.
      const current = this.getJob(id);
      if (current) {
        const newCron = fields.cron ?? current.cron;
        const newTz = fields.timezone ?? current.timezone;
        sets.push("next_run_at = ?");
        values.push(computeNextRun(newCron, newTz));
      }
    }

    if (sets.length === 0) return;

    sets.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);

    this.db
      .prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  deleteJob(id: string): void {
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM job_runs WHERE job_id = ?").run(id);
      this.db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
    })();
  }

  getDueJobs(): JobRow[] {
    return this.db
      .prepare(
        "SELECT * FROM jobs WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at ASC",
      )
      .all(Date.now()) as JobRow[];
  }

  // ── Runs ─────────────────────────────────────────────────────────

  createRun(jobId: string): JobRunRow {
    const id = randomUUID();
    const started_at = Date.now();

    this.db
      .prepare(
        `INSERT INTO job_runs (id, job_id, started_at, status)
         VALUES (?, ?, ?, 'running')`,
      )
      .run(id, jobId, started_at);

    return {
      id,
      job_id: jobId,
      started_at,
      completed_at: null,
      status: "running",
      result: null,
    };
  }

  updateRun(
    id: string,
    fields: {
      status?: JobRunStatus;
      result?: string | null;
    },
  ): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.status !== undefined) {
      sets.push("status = ?");
      values.push(fields.status);

      // Auto-set completed_at when transitioning to a terminal state
      if (fields.status === "success" || fields.status === "error") {
        sets.push("completed_at = ?");
        values.push(Date.now());
      }
    }
    if (fields.result !== undefined) {
      sets.push("result = ?");
      values.push(fields.result);
    }

    if (sets.length === 0) return;

    values.push(id);
    this.db
      .prepare(`UPDATE job_runs SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  listRuns(jobId: string, limit = 10): JobRunRow[] {
    return this.db
      .prepare(
        "SELECT * FROM job_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?",
      )
      .all(jobId, limit) as JobRunRow[];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
