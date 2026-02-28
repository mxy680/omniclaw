# Jobs (Cron) System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add scheduled cron jobs to omniclaw, configurable through agent conversation, supporting both direct tool execution and agent-driven prompts.

**Architecture:** SQLite store (`JobStore`) for persistence, in-process scheduler (`JobScheduler`) with 60-second tick loop, six management tools registered in the tool registry. Uses `croner` library for cron parsing. Scheduler lives in the channel plugin lifecycle alongside DispatchManager and TaskStore.

**Tech Stack:** TypeScript, better-sqlite3, croner, @sinclair/typebox, vitest

---

### Task 1: Install croner dependency

**Files:**
- Modify: `package.json`

**Step 1: Install croner**

Run: `cd /Users/markshteyn/omniclaw && pnpm add croner`

**Step 2: Verify install**

Run: `node -e "import('croner').then(m => console.log('OK', typeof m.Cron))"`
Expected: `OK function`

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add croner dependency for job scheduling"
```

---

### Task 2: Add `jobs_db_path` to PluginConfig

**Files:**
- Modify: `src/types/plugin-config.ts:25` (near `nutrition_db_path`)

**Step 1: Add the field**

Add `jobs_db_path?: string;` to the `PluginConfig` interface, right after the `nutrition_db_path` line (line 25):

```typescript
  nutrition_db_path?: string;
  jobs_db_path?: string;
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compile

**Step 3: Commit**

```bash
git add src/types/plugin-config.ts
git commit -m "feat(jobs): add jobs_db_path to PluginConfig"
```

---

### Task 3: Create JobStore with tests

**Files:**
- Create: `src/channel/job-store.ts`
- Create: `tests/unit/job-store.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/job-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JobStore } from "../../src/channel/job-store.js";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("JobStore", () => {
  let store: JobStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "job-store-test-"));
    store = new JobStore(join(tmpDir, "test-jobs.db"));
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Jobs CRUD ─────────────────────────────────────────────

  it("creates and retrieves a tool-mode job", () => {
    const job = store.createJob({
      name: "Check inbox",
      cron: "0 8 * * *",
      timezone: "America/New_York",
      mode: "tool",
      tool_name: "gmail_inbox",
      tool_params: JSON.stringify({ account: "default", max_results: 5 }),
    });

    expect(job.id).toBeDefined();
    expect(job.name).toBe("Check inbox");
    expect(job.mode).toBe("tool");
    expect(job.enabled).toBe(1);
    expect(job.next_run_at).toBeGreaterThan(Date.now() - 1000);

    const fetched = store.getJob(job.id);
    expect(fetched).toEqual(job);
  });

  it("creates an agent-mode job", () => {
    const job = store.createJob({
      name: "Weekly summary",
      cron: "0 9 * * 1",
      timezone: "UTC",
      mode: "agent",
      prompt: "Summarize my unread emails from the past week",
    });

    expect(job.mode).toBe("agent");
    expect(job.prompt).toBe("Summarize my unread emails from the past week");
    expect(job.tool_name).toBeNull();
  });

  it("lists all jobs", () => {
    store.createJob({ name: "Job A", cron: "* * * * *", timezone: "UTC", mode: "tool", tool_name: "gmail_inbox" });
    store.createJob({ name: "Job B", cron: "* * * * *", timezone: "UTC", mode: "agent", prompt: "test" });

    const all = store.listJobs();
    expect(all).toHaveLength(2);
  });

  it("filters jobs by enabled status", () => {
    const j1 = store.createJob({ name: "Active", cron: "* * * * *", timezone: "UTC", mode: "tool", tool_name: "t" });
    const j2 = store.createJob({ name: "Disabled", cron: "* * * * *", timezone: "UTC", mode: "tool", tool_name: "t" });
    store.updateJob(j2.id, { enabled: 0 });

    expect(store.listJobs({ enabled: true })).toHaveLength(1);
    expect(store.listJobs({ enabled: false })).toHaveLength(1);
  });

  it("updates a job", () => {
    const job = store.createJob({ name: "Old", cron: "0 8 * * *", timezone: "UTC", mode: "tool", tool_name: "t" });
    store.updateJob(job.id, { name: "New", cron: "0 9 * * *", enabled: 0 });

    const updated = store.getJob(job.id)!;
    expect(updated.name).toBe("New");
    expect(updated.cron).toBe("0 9 * * *");
    expect(updated.enabled).toBe(0);
    expect(updated.updated_at).toBeGreaterThanOrEqual(job.updated_at);
  });

  it("deletes a job and its runs", () => {
    const job = store.createJob({ name: "Doomed", cron: "* * * * *", timezone: "UTC", mode: "tool", tool_name: "t" });
    store.createRun(job.id);
    store.deleteJob(job.id);

    expect(store.getJob(job.id)).toBeUndefined();
    expect(store.listRuns(job.id)).toHaveLength(0);
  });

  it("returns undefined for nonexistent job", () => {
    expect(store.getJob("nope")).toBeUndefined();
  });

  // ── getDueJobs ────────────────────────────────────────────

  it("returns jobs due for execution", () => {
    const j1 = store.createJob({ name: "Due", cron: "* * * * *", timezone: "UTC", mode: "tool", tool_name: "t" });
    // Force next_run_at to the past
    store.updateJob(j1.id, { next_run_at: Date.now() - 60_000 });

    const j2 = store.createJob({ name: "Future", cron: "* * * * *", timezone: "UTC", mode: "tool", tool_name: "t" });
    // Force next_run_at to the future
    store.updateJob(j2.id, { next_run_at: Date.now() + 3_600_000 });

    const due = store.getDueJobs();
    expect(due).toHaveLength(1);
    expect(due[0].name).toBe("Due");
  });

  it("excludes disabled jobs from due list", () => {
    const j = store.createJob({ name: "Disabled", cron: "* * * * *", timezone: "UTC", mode: "tool", tool_name: "t" });
    store.updateJob(j.id, { next_run_at: Date.now() - 60_000, enabled: 0 });

    expect(store.getDueJobs()).toHaveLength(0);
  });

  // ── Runs ──────────────────────────────────────────────────

  it("creates and updates a run", () => {
    const job = store.createJob({ name: "J", cron: "* * * * *", timezone: "UTC", mode: "tool", tool_name: "t" });
    const run = store.createRun(job.id);

    expect(run.status).toBe("running");
    expect(run.job_id).toBe(job.id);

    store.updateRun(run.id, { status: "success", result: JSON.stringify({ ok: true }) });
    const runs = store.listRuns(job.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("success");
    expect(runs[0].completed_at).toBeGreaterThan(0);
  });

  it("lists runs with limit", () => {
    const job = store.createJob({ name: "J", cron: "* * * * *", timezone: "UTC", mode: "tool", tool_name: "t" });
    for (let i = 0; i < 15; i++) {
      const run = store.createRun(job.id);
      store.updateRun(run.id, { status: "success" });
    }

    expect(store.listRuns(job.id, 5)).toHaveLength(5);
    expect(store.listRuns(job.id)).toHaveLength(10); // default limit
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/job-store.test.ts`
Expected: FAIL — `Cannot find module '../../src/channel/job-store.js'`

**Step 3: Write JobStore implementation**

Create `src/channel/job-store.ts`:

```typescript
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
  enabled: number; // 0 or 1 (SQLite boolean)
  next_run_at: number | null;
  last_run_at: number | null;
  last_status: string | null;
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

// ── Helpers ─────────────────────────────────────────────────────────

export function computeNextRun(cronExpr: string, timezone: string): number {
  const job = new Cron(cronExpr, { timezone });
  const next = job.nextRun();
  if (!next) throw new Error(`Invalid cron expression: ${cronExpr}`);
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
        next_run_at  INTEGER,
        last_run_at  INTEGER,
        last_status  TEXT,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(enabled, next_run_at);

      CREATE TABLE IF NOT EXISTS job_runs (
        id           TEXT PRIMARY KEY,
        job_id       TEXT NOT NULL,
        started_at   INTEGER NOT NULL,
        completed_at INTEGER,
        status       TEXT NOT NULL DEFAULT 'running',
        result       TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_job_runs_job ON job_runs(job_id, started_at DESC);
    `);
  }

  // ── Jobs CRUD ─────────────────────────────────────────────────

  createJob(input: CreateJobInput): JobRow {
    const id = randomUUID();
    const now = Date.now();
    const nextRun = computeNextRun(input.cron, input.timezone);

    this.db
      .prepare(
        `INSERT INTO jobs (id, name, cron, timezone, mode, tool_name, tool_params, prompt, enabled, next_run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.cron,
        input.timezone,
        input.mode,
        input.tool_name ?? null,
        input.tool_params ?? null,
        input.prompt ?? null,
        nextRun,
        now,
        now,
      );

    return this.getJob(id)!;
  }

  getJob(id: string): JobRow | undefined {
    return this.db
      .prepare("SELECT * FROM jobs WHERE id = ?")
      .get(id) as JobRow | undefined;
  }

  listJobs(filter?: JobFilter): JobRow[] {
    if (filter?.enabled !== undefined) {
      const val = filter.enabled ? 1 : 0;
      return this.db
        .prepare("SELECT * FROM jobs WHERE enabled = ? ORDER BY updated_at DESC")
        .all(val) as JobRow[];
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
      tool_name?: string;
      tool_params?: string;
      prompt?: string;
      enabled?: number;
      next_run_at?: number;
      last_run_at?: number;
      last_status?: string;
    },
  ): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (sets.length === 0) return;

    // Recompute next_run_at if cron or timezone changed
    if (fields.cron !== undefined || fields.timezone !== undefined) {
      const current = this.getJob(id);
      if (current) {
        const cronExpr = fields.cron ?? current.cron;
        const tz = fields.timezone ?? current.timezone;
        const nextRun = computeNextRun(cronExpr, tz);
        if (fields.next_run_at === undefined) {
          sets.push("next_run_at = ?");
          values.push(nextRun);
        }
      }
    }

    sets.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);

    this.db
      .prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  deleteJob(id: string): void {
    this.db.prepare("DELETE FROM job_runs WHERE job_id = ?").run(id);
    this.db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  }

  getDueJobs(): JobRow[] {
    return this.db
      .prepare("SELECT * FROM jobs WHERE enabled = 1 AND next_run_at <= ?")
      .all(Date.now()) as JobRow[];
  }

  // ── Runs ──────────────────────────────────────────────────────

  createRun(jobId: string): JobRunRow {
    const id = randomUUID();
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO job_runs (id, job_id, started_at, status)
         VALUES (?, ?, ?, 'running')`,
      )
      .run(id, jobId, now);

    return { id, job_id: jobId, started_at: now, completed_at: null, status: "running", result: null };
  }

  updateRun(
    id: string,
    fields: { status?: JobRunStatus; result?: string },
  ): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.status !== undefined) {
      sets.push("status = ?");
      values.push(fields.status);
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
      .prepare("SELECT * FROM job_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?")
      .all(jobId, limit) as JobRunRow[];
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/job-store.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/channel/job-store.ts tests/unit/job-store.test.ts
git commit -m "feat(jobs): add JobStore with SQLite persistence and tests"
```

---

### Task 4: Create JobScheduler with tests

**Files:**
- Create: `src/channel/job-scheduler.ts`
- Create: `tests/unit/job-scheduler.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/job-scheduler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobScheduler } from "../../src/channel/job-scheduler.js";
import { JobStore } from "../../src/channel/job-store.js";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("JobScheduler", () => {
  let store: JobStore;
  let scheduler: JobScheduler;
  let tmpDir: string;
  let executeTool: ReturnType<typeof vi.fn>;
  let dispatchAgentPrompt: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "job-sched-test-"));
    store = new JobStore(join(tmpDir, "test-jobs.db"));
    executeTool = vi.fn().mockResolvedValue({ ok: true });
    dispatchAgentPrompt = vi.fn().mockResolvedValue(undefined);
    scheduler = new JobScheduler({
      store,
      executeTool,
      dispatchAgentPrompt,
    });
  });

  afterEach(() => {
    scheduler.stop();
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("executes a due tool-mode job", async () => {
    const job = store.createJob({
      name: "Test tool job",
      cron: "* * * * *",
      timezone: "UTC",
      mode: "tool",
      tool_name: "gmail_inbox",
      tool_params: JSON.stringify({ account: "default" }),
    });
    // Force due
    store.updateJob(job.id, { next_run_at: Date.now() - 60_000 });

    await scheduler.tick();

    expect(executeTool).toHaveBeenCalledWith(
      "gmail_inbox",
      { account: "default" },
      expect.any(String), // run ID
    );

    const runs = store.listRuns(job.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("success");

    // next_run_at should be updated to the future
    const updated = store.getJob(job.id)!;
    expect(updated.next_run_at).toBeGreaterThan(Date.now() - 1000);
    expect(updated.last_run_at).toBeGreaterThan(0);
    expect(updated.last_status).toBe("success");
  });

  it("executes a due agent-mode job", async () => {
    const job = store.createJob({
      name: "Test agent job",
      cron: "* * * * *",
      timezone: "UTC",
      mode: "agent",
      prompt: "Summarize my emails",
    });
    store.updateJob(job.id, { next_run_at: Date.now() - 60_000 });

    await scheduler.tick();

    expect(dispatchAgentPrompt).toHaveBeenCalledWith("Summarize my emails", expect.any(String));
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("records error when tool execution fails", async () => {
    executeTool.mockRejectedValueOnce(new Error("auth expired"));

    const job = store.createJob({
      name: "Failing job",
      cron: "* * * * *",
      timezone: "UTC",
      mode: "tool",
      tool_name: "gmail_inbox",
    });
    store.updateJob(job.id, { next_run_at: Date.now() - 60_000 });

    await scheduler.tick();

    const runs = store.listRuns(job.id);
    expect(runs[0].status).toBe("error");
    expect(runs[0].result).toContain("auth expired");

    const updated = store.getJob(job.id)!;
    expect(updated.last_status).toBe("error");
    // Should still advance next_run_at even on error
    expect(updated.next_run_at).toBeGreaterThan(Date.now() - 1000);
  });

  it("does not execute jobs that are not yet due", async () => {
    store.createJob({
      name: "Future job",
      cron: "* * * * *",
      timezone: "UTC",
      mode: "tool",
      tool_name: "gmail_inbox",
    });
    // next_run_at is already in the future from createJob

    await scheduler.tick();

    expect(executeTool).not.toHaveBeenCalled();
  });

  it("does not execute disabled jobs", async () => {
    const job = store.createJob({
      name: "Disabled",
      cron: "* * * * *",
      timezone: "UTC",
      mode: "tool",
      tool_name: "gmail_inbox",
    });
    store.updateJob(job.id, { next_run_at: Date.now() - 60_000, enabled: 0 });

    await scheduler.tick();

    expect(executeTool).not.toHaveBeenCalled();
  });

  it("start/stop controls the interval", () => {
    vi.useFakeTimers();

    scheduler.start();
    // Should set an interval (not throw)
    scheduler.stop();
    // Should clear the interval (not throw)
    scheduler.stop(); // double-stop is safe

    vi.useRealTimers();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/job-scheduler.test.ts`
Expected: FAIL — `Cannot find module '../../src/channel/job-scheduler.js'`

**Step 3: Write JobScheduler implementation**

Create `src/channel/job-scheduler.ts`:

```typescript
import { computeNextRun, type JobStore, type JobRow } from "./job-store.js";

export type JobSchedulerConfig = {
  store: JobStore;
  executeTool: (toolName: string, params: Record<string, unknown>, runId: string) => Promise<unknown>;
  dispatchAgentPrompt: (prompt: string, runId: string) => Promise<void>;
  tickIntervalMs?: number;
};

export class JobScheduler {
  private store: JobStore;
  private executeTool: JobSchedulerConfig["executeTool"];
  private dispatchAgentPrompt: JobSchedulerConfig["dispatchAgentPrompt"];
  private tickIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: JobSchedulerConfig) {
    this.store = config.store;
    this.executeTool = config.executeTool;
    this.dispatchAgentPrompt = config.dispatchAgentPrompt;
    this.tickIntervalMs = config.tickIntervalMs ?? 60_000;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.error("[JobScheduler] tick error:", err);
      });
    }, this.tickIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    const dueJobs = this.store.getDueJobs();

    for (const job of dueJobs) {
      await this.executeJob(job);
    }
  }

  private async executeJob(job: JobRow): Promise<void> {
    const run = this.store.createRun(job.id);

    try {
      if (job.mode === "tool" && job.tool_name) {
        const params = job.tool_params ? JSON.parse(job.tool_params) : {};
        await this.executeTool(job.tool_name, params, run.id);
      } else if (job.mode === "agent" && job.prompt) {
        await this.dispatchAgentPrompt(job.prompt, run.id);
      } else {
        throw new Error(`Invalid job config: mode=${job.mode}, tool_name=${job.tool_name}, prompt=${job.prompt}`);
      }

      this.store.updateRun(run.id, { status: "success" });
      this.store.updateJob(job.id, {
        last_run_at: Date.now(),
        last_status: "success",
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.store.updateRun(run.id, {
        status: "error",
        result: JSON.stringify({ error: errorMsg }),
      });
      this.store.updateJob(job.id, {
        last_run_at: Date.now(),
        last_status: "error",
      });
    }

    // Always advance next_run_at, even on error
    try {
      const nextRun = computeNextRun(job.cron, job.timezone);
      this.store.updateJob(job.id, { next_run_at: nextRun });
    } catch {
      // If cron is somehow invalid, disable the job
      this.store.updateJob(job.id, { enabled: 0 });
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/job-scheduler.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/channel/job-scheduler.ts tests/unit/job-scheduler.test.ts
git commit -m "feat(jobs): add JobScheduler with tick loop and tests"
```

---

### Task 5: Create job tools

**Files:**
- Create: `src/tools/job-tools.ts`

**Step 1: Write the tool implementations**

Create `src/tools/job-tools.ts`. Follow the pattern from `src/tools/task-tools.ts`:
- Import `Type` from `@sinclair/typebox`.
- Import `getJobStore` from `../channel/channel-plugin.js` (will be added in Task 6, use lazy access pattern).
- Import `getWsServer` from `../channel/send.js`.
- Import `Intl.DateTimeFormat` to resolve the default timezone.
- Use `Cron` from `croner` to validate cron expressions.
- Helper: `requireStore()` throws if store not initialized.
- Helper: `jsonResult(payload)` wraps response.
- Helper: `broadcastJobUpdate(job)` broadcasts via WebSocket.

```typescript
import { Type } from "@sinclair/typebox";
import { getJobStore } from "../channel/channel-plugin.js";
import { getWsServer } from "../channel/send.js";
import { computeNextRun, type JobRow } from "../channel/job-store.js";
import { Cron } from "croner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function requireStore() {
  const store = getJobStore();
  if (!store) throw new Error("Job store not initialized — iOS channel not running");
  return store;
}

function broadcastJobUpdate(job: JobRow) {
  const ws = getWsServer();
  if (ws) ws.broadcast({ type: "job_updated", job: toWsJob(job) });
}

function toWsJob(row: JobRow) {
  return {
    id: row.id,
    name: row.name,
    cron: row.cron,
    timezone: row.timezone,
    mode: row.mode,
    toolName: row.tool_name,
    toolParams: row.tool_params ? JSON.parse(row.tool_params) : null,
    prompt: row.prompt,
    enabled: row.enabled === 1,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateCron(expr: string): void {
  try {
    new Cron(expr);
  } catch {
    throw new Error(`Invalid cron expression: "${expr}"`);
  }
}

function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ── job_create ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobCreateTool(): any {
  return {
    name: "job_create",
    label: "Create Scheduled Job",
    description:
      "Create a new scheduled job. Supports two modes: 'tool' executes a specific tool with fixed params, " +
      "'agent' dispatches a natural language prompt to the agent. Uses standard cron expressions (minute hour day month weekday).",
    parameters: Type.Object({
      name: Type.String({ description: "Human-readable name for the job" }),
      cron: Type.String({ description: "Cron expression (e.g., '0 8 * * *' for 8am daily, '0 9 * * 1' for 9am Mondays)" }),
      timezone: Type.Optional(
        Type.String({ description: "IANA timezone (e.g., 'America/New_York'). Defaults to system local timezone." }),
      ),
      mode: Type.Union([Type.Literal("tool"), Type.Literal("agent")], {
        description: "'tool' for direct tool execution, 'agent' for natural language prompt",
      }),
      tool_name: Type.Optional(Type.String({ description: "Tool to execute (required for mode='tool')" })),
      tool_params: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), { description: "Parameters to pass to the tool (for mode='tool')" }),
      ),
      prompt: Type.Optional(Type.String({ description: "Natural language prompt (required for mode='agent')" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        name: string;
        cron: string;
        timezone?: string;
        mode: "tool" | "agent";
        tool_name?: string;
        tool_params?: Record<string, unknown>;
        prompt?: string;
      },
    ) {
      const store = requireStore();

      validateCron(params.cron);

      if (params.mode === "tool" && !params.tool_name) {
        return jsonResult({ status: "error", error: "tool_name is required when mode is 'tool'" });
      }
      if (params.mode === "agent" && !params.prompt) {
        return jsonResult({ status: "error", error: "prompt is required when mode is 'agent'" });
      }

      const timezone = params.timezone ?? getLocalTimezone();
      const job = store.createJob({
        name: params.name,
        cron: params.cron,
        timezone,
        mode: params.mode,
        tool_name: params.tool_name,
        tool_params: params.tool_params ? JSON.stringify(params.tool_params) : undefined,
        prompt: params.prompt,
      });

      broadcastJobUpdate(job);
      return jsonResult({ status: "created", job: toWsJob(job) });
    },
  };
}

// ── job_list ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobListTool(): any {
  return {
    name: "job_list",
    label: "List Scheduled Jobs",
    description: "List all scheduled jobs, optionally filtered by enabled status.",
    parameters: Type.Object({
      enabled: Type.Optional(Type.Boolean({ description: "Filter: true for active jobs only, false for paused only" })),
    }),
    async execute(
      _toolCallId: string,
      params: { enabled?: boolean },
    ) {
      const store = requireStore();
      const filter = params.enabled !== undefined ? { enabled: params.enabled } : undefined;
      const jobs = store.listJobs(filter).map(toWsJob);
      return jsonResult({ jobs });
    },
  };
}

// ── job_get ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobGetTool(): any {
  return {
    name: "job_get",
    label: "Get Scheduled Job",
    description: "Get a single scheduled job by ID, including recent run history.",
    parameters: Type.Object({
      id: Type.String({ description: "Job ID" }),
      run_limit: Type.Optional(Type.Number({ description: "Max number of runs to include (default 10)" })),
    }),
    async execute(
      _toolCallId: string,
      params: { id: string; run_limit?: number },
    ) {
      const store = requireStore();
      const job = store.getJob(params.id);
      if (!job) {
        return jsonResult({ status: "error", error: `Job ${params.id} not found` });
      }
      const runs = store.listRuns(params.id, params.run_limit ?? 10);
      return jsonResult({ job: toWsJob(job), runs });
    },
  };
}

// ── job_update ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobUpdateTool(): any {
  return {
    name: "job_update",
    label: "Update Scheduled Job",
    description: "Update a scheduled job's name, schedule, parameters, or enabled status.",
    parameters: Type.Object({
      id: Type.String({ description: "Job ID" }),
      name: Type.Optional(Type.String({ description: "New name" })),
      cron: Type.Optional(Type.String({ description: "New cron expression" })),
      timezone: Type.Optional(Type.String({ description: "New IANA timezone" })),
      tool_name: Type.Optional(Type.String({ description: "New tool name" })),
      tool_params: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), { description: "New tool parameters" }),
      ),
      prompt: Type.Optional(Type.String({ description: "New agent prompt" })),
      enabled: Type.Optional(Type.Boolean({ description: "Enable or disable the job" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        id: string;
        name?: string;
        cron?: string;
        timezone?: string;
        tool_name?: string;
        tool_params?: Record<string, unknown>;
        prompt?: string;
        enabled?: boolean;
      },
    ) {
      const store = requireStore();
      const existing = store.getJob(params.id);
      if (!existing) {
        return jsonResult({ status: "error", error: `Job ${params.id} not found` });
      }

      if (params.cron) validateCron(params.cron);

      store.updateJob(params.id, {
        name: params.name,
        cron: params.cron,
        timezone: params.timezone,
        tool_name: params.tool_name,
        tool_params: params.tool_params ? JSON.stringify(params.tool_params) : undefined,
        prompt: params.prompt,
        enabled: params.enabled !== undefined ? (params.enabled ? 1 : 0) : undefined,
      });

      const updated = store.getJob(params.id)!;
      broadcastJobUpdate(updated);
      return jsonResult({ status: "updated", job: toWsJob(updated) });
    },
  };
}

// ── job_delete ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobDeleteTool(): any {
  return {
    name: "job_delete",
    label: "Delete Scheduled Job",
    description: "Delete a scheduled job and all its run history.",
    parameters: Type.Object({
      id: Type.String({ description: "Job ID to delete" }),
    }),
    async execute(
      _toolCallId: string,
      params: { id: string },
    ) {
      const store = requireStore();
      const existing = store.getJob(params.id);
      if (!existing) {
        return jsonResult({ status: "error", error: `Job ${params.id} not found` });
      }

      store.deleteJob(params.id);

      const ws = getWsServer();
      if (ws) ws.broadcast({ type: "job_deleted", jobId: params.id });

      return jsonResult({ status: "deleted", jobId: params.id });
    },
  };
}

// ── job_run_now ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobRunNowTool(): any {
  return {
    name: "job_run_now",
    label: "Run Job Now",
    description:
      "Trigger a scheduled job immediately, regardless of its cron schedule. " +
      "Does not affect the next scheduled run time.",
    parameters: Type.Object({
      id: Type.String({ description: "Job ID to run immediately" }),
    }),
    async execute(
      _toolCallId: string,
      params: { id: string },
    ) {
      const store = requireStore();
      const job = store.getJob(params.id);
      if (!job) {
        return jsonResult({ status: "error", error: `Job ${params.id} not found` });
      }

      // Import the scheduler to trigger execution
      const { getJobScheduler } = await import("../channel/channel-plugin.js");
      const scheduler = getJobScheduler();
      if (!scheduler) {
        return jsonResult({ status: "error", error: "Job scheduler not running" });
      }

      await scheduler.runJob(job);

      const updated = store.getJob(params.id)!;
      broadcastJobUpdate(updated);
      const lastRun = store.listRuns(params.id, 1);
      return jsonResult({
        status: "executed",
        job: toWsJob(updated),
        run: lastRun[0] ?? null,
      });
    },
  };
}
```

**Step 2: Verify build compiles** (will fail until Task 6 wires channel-plugin exports — that's expected)

This task depends on Task 6 for `getJobStore` / `getJobScheduler` exports. We'll verify the build after Task 6.

**Step 3: Commit**

```bash
git add src/tools/job-tools.ts
git commit -m "feat(jobs): add 6 job management tools"
```

---

### Task 6: Wire JobStore + JobScheduler into channel-plugin and tool registry

**Files:**
- Modify: `src/channel/channel-plugin.ts`
- Modify: `src/mcp/tool-registry.ts`

**Step 1: Update channel-plugin.ts**

Add to `src/channel/channel-plugin.ts`:

1. Import `JobStore` and `JobScheduler` at the top:
   ```typescript
   import { JobStore } from "./job-store.js";
   import { JobScheduler } from "./job-scheduler.js";
   ```

2. Add singletons after the existing `activeTaskStore` line (around line 28):
   ```typescript
   let activeJobStore: JobStore | null = null;
   let activeJobScheduler: JobScheduler | null = null;
   ```

3. Add accessor functions after `getTaskStore()`:
   ```typescript
   export function getJobStore(): JobStore | null {
     return activeJobStore;
   }

   export function getJobScheduler(): JobScheduler | null {
     return activeJobScheduler;
   }
   ```

4. In `startAccount` (inside the `gateway` object), after `activeTaskStore = taskStore;` (around line 134):
   ```typescript
   const jobDbPath = pluginCfg.jobs_db_path ?? undefined;
   const jobStore = new JobStore(jobDbPath);
   activeJobStore = jobStore;

   const jobScheduler = new JobScheduler({
     store: jobStore,
     executeTool: async (toolName, params, runId) => {
       // Look up tool from the registry and execute
       const { createAllTools } = await import("../mcp/tool-registry.js");
       const tools = createAllTools({ pluginConfig: pluginCfg });
       const tool = tools.find((t) => t.name === toolName);
       if (!tool) throw new Error(`Tool '${toolName}' not found`);
       await tool.execute(runId, params);
     },
     dispatchAgentPrompt: async (prompt, runId) => {
       await dispatchManager.submit({
         conversationId: `job-${runId}`,
         connId: "job-scheduler",
         priority: "background",
         fn: async () => {
           await handleIosInbound({
             text: prompt,
             messageId: runId,
             conversationId: `job-${runId}`,
             connId: "job-scheduler",
             account,
             config: cfg,
             runtime,
             store,
             wsServer,
             statusSink: (patch) =>
               ctx.log?.info(`[job-scheduler] status: ${JSON.stringify(patch)}`),
           });
         },
       });
     },
   });
   activeJobScheduler = jobScheduler;
   jobScheduler.start();
   ```

5. In the `stop` function, before `activeTaskStore = null;`:
   ```typescript
   jobScheduler.stop();
   jobStore.close();
   activeJobStore = null;
   activeJobScheduler = null;
   ```

**Step 2: Add `runJob` method to JobScheduler**

The `job_run_now` tool calls `scheduler.runJob(job)`. Add this public method to `src/channel/job-scheduler.ts`:

```typescript
/** Execute a job immediately (used by job_run_now tool). Does not advance next_run_at. */
async runJob(job: JobRow): Promise<void> {
  const run = this.store.createRun(job.id);

  try {
    if (job.mode === "tool" && job.tool_name) {
      const params = job.tool_params ? JSON.parse(job.tool_params) : {};
      await this.executeTool(job.tool_name, params, run.id);
    } else if (job.mode === "agent" && job.prompt) {
      await this.dispatchAgentPrompt(job.prompt, run.id);
    } else {
      throw new Error(`Invalid job config: mode=${job.mode}`);
    }

    this.store.updateRun(run.id, { status: "success" });
    this.store.updateJob(job.id, {
      last_run_at: Date.now(),
      last_status: "success",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    this.store.updateRun(run.id, {
      status: "error",
      result: JSON.stringify({ error: errorMsg }),
    });
    this.store.updateJob(job.id, {
      last_run_at: Date.now(),
      last_status: "error",
    });
    throw err; // Re-throw so the tool can report the error
  }
}
```

**Step 3: Update tool-registry.ts**

Add imports near the task tool imports (around line 288):
```typescript
import {
  createJobCreateTool,
  createJobListTool,
  createJobGetTool,
  createJobUpdateTool,
  createJobDeleteTool,
  createJobRunNowTool,
} from "../tools/job-tools.js";
```

Add registrations after the task tools block (after line 341):
```typescript
  // Job tools — register unconditionally, use lazy store access
  add(createJobCreateTool());
  add(createJobListTool());
  add(createJobGetTool());
  add(createJobUpdateTool());
  add(createJobDeleteTool());
  add(createJobRunNowTool());
```

**Step 4: Verify build**

Run: `pnpm build`
Expected: Clean compile

**Step 5: Run all unit tests**

Run: `pnpm test`
Expected: All pass (including existing tests + new job-store and job-scheduler tests)

**Step 6: Commit**

```bash
git add src/channel/channel-plugin.ts src/channel/job-scheduler.ts src/mcp/tool-registry.ts src/types/plugin-config.ts
git commit -m "feat(jobs): wire JobStore + JobScheduler into channel plugin and tool registry"
```

---

### Task 7: Update CLAUDE.md kanban and add skill file

**Files:**
- Modify: `CLAUDE.md` — move Jobs to "Done" in kanban
- Create: `skills/jobs.SKILL.md` — agent skill doc for job management

**Step 1: Add Jobs to the Done table in CLAUDE.md**

Add a row to the Done table:
```markdown
| Jobs (Cron) | 6 | `jobs` | `docs/plans/2026-02-28-jobs-cron-design.md` | In-process scheduler, tool + agent modes |
```

**Step 2: Create the skill file**

Create `skills/jobs.SKILL.md`:

```markdown
# Jobs (Scheduled Tasks)

Schedule recurring tasks using cron expressions. Two modes: direct tool execution or agent-driven prompts.

## Tools

| Tool | Description |
|---|---|
| `job_create` | Create a new scheduled job |
| `job_list` | List all scheduled jobs |
| `job_get` | Get job details + run history |
| `job_update` | Update job schedule, params, or enabled status |
| `job_delete` | Delete a job and its run history |
| `job_run_now` | Trigger a job immediately |

## Modes

- **Tool mode**: Execute a specific omniclaw tool with fixed parameters. No LLM inference needed.
- **Agent mode**: Send a natural language prompt to the agent. Runs as a background dispatch.

## Cron Expressions

Standard 5-field format: `minute hour day month weekday`

| Expression | Meaning |
|---|---|
| `0 8 * * *` | Every day at 8:00 AM |
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | First day of every month at midnight |

All times are in the configured timezone (defaults to system local).

## Examples

Create a daily inbox check:
```
job_create(name: "Morning inbox", cron: "0 8 * * *", mode: "tool", tool_name: "gmail_inbox", tool_params: { account: "default", max_results: 10 })
```

Create a weekly summary:
```
job_create(name: "Weekly summary", cron: "0 9 * * 1", mode: "agent", prompt: "Summarize my unread emails and upcoming calendar events for this week")
```

Pause a job:
```
job_update(id: "<job-id>", enabled: false)
```
```

**Step 3: Commit**

```bash
git add CLAUDE.md skills/jobs.SKILL.md
git commit -m "docs(jobs): add kanban entry and agent skill file"
```
