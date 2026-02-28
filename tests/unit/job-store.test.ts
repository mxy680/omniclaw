import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { JobStore } from "../../src/channel/job-store.js";
import type { CreateJobInput } from "../../src/channel/job-store.js";

// Every-minute cron so nextRun is always in the near future
const EVERY_MINUTE = "* * * * *";
const TZ = "UTC";

function makeStore(dir: string): JobStore {
  return new JobStore(join(dir, "jobs.db"));
}

function toolJob(overrides?: Partial<CreateJobInput>): CreateJobInput {
  return {
    name: "My Tool Job",
    cron: EVERY_MINUTE,
    timezone: TZ,
    mode: "tool",
    tool_name: "gmail_list",
    tool_params: JSON.stringify({ limit: 10 }),
    ...overrides,
  };
}

function agentJob(overrides?: Partial<CreateJobInput>): CreateJobInput {
  return {
    name: "My Agent Job",
    cron: "0 9 * * 1", // Monday 9am
    timezone: "America/New_York",
    mode: "agent",
    prompt: "Summarise my unread emails",
    ...overrides,
  };
}

describe("JobStore", () => {
  let tmpDir: string;
  let store: JobStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "job-store-test-"));
    store = makeStore(tmpDir);
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Basic CRUD ──────────────────────────────────────────────────────

  it("creates and retrieves a tool-mode job", () => {
    const job = store.createJob(toolJob());

    expect(job.id).toMatch(/^[0-9a-f-]{36}$/); // UUID
    expect(job.name).toBe("My Tool Job");
    expect(job.mode).toBe("tool");
    expect(job.tool_name).toBe("gmail_list");
    expect(job.tool_params).toBe(JSON.stringify({ limit: 10 }));
    expect(job.enabled).toBe(1);
    expect(job.next_run_at).toBeGreaterThan(Date.now() - 1000);
    expect(job.created_at).toBeGreaterThan(0);
    expect(job.updated_at).toBeGreaterThan(0);

    const fetched = store.getJob(job.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(job.id);
    expect(fetched!.name).toBe("My Tool Job");
  });

  it("creates an agent-mode job", () => {
    const job = store.createJob(agentJob());

    expect(job.mode).toBe("agent");
    expect(job.prompt).toBe("Summarise my unread emails");
    expect(job.tool_name).toBeNull();
    expect(job.tool_params).toBeNull();
    // next_run_at should be in the future
    expect(job.next_run_at).toBeGreaterThan(Date.now());
  });

  it("lists all jobs", () => {
    store.createJob(toolJob({ name: "Job A" }));
    store.createJob(toolJob({ name: "Job B" }));
    store.createJob(agentJob({ name: "Job C" }));

    const jobs = store.listJobs();
    expect(jobs).toHaveLength(3);
  });

  it("filters jobs by enabled status", () => {
    store.createJob(toolJob({ name: "Enabled Job" }));
    const disabled = store.createJob(toolJob({ name: "Disabled Job" }));
    store.updateJob(disabled.id, { enabled: false });

    const enabled = store.listJobs({ enabled: true });
    expect(enabled).toHaveLength(1);
    expect(enabled[0].name).toBe("Enabled Job");

    const disabledList = store.listJobs({ enabled: false });
    expect(disabledList).toHaveLength(1);
    expect(disabledList[0].name).toBe("Disabled Job");
  });

  it("updates a job name, cron, and enabled flag", () => {
    const job = store.createJob(toolJob());
    const oldNextRun = job.next_run_at;

    store.updateJob(job.id, {
      name: "Renamed Job",
      cron: "0 * * * *", // every hour
      enabled: false,
    });

    const updated = store.getJob(job.id)!;
    expect(updated.name).toBe("Renamed Job");
    expect(updated.cron).toBe("0 * * * *");
    expect(updated.enabled).toBe(0);
    // next_run_at must have been recomputed (hourly > minutely so it's >= old)
    expect(updated.next_run_at).toBeGreaterThanOrEqual(oldNextRun);
    expect(updated.updated_at).toBeGreaterThanOrEqual(job.updated_at);
  });

  it("deletes a job and its runs", () => {
    const job = store.createJob(toolJob());
    const run = store.createRun(job.id);
    store.updateRun(run.id, { status: "success", result: "ok" });

    store.deleteJob(job.id);

    expect(store.getJob(job.id)).toBeUndefined();
    expect(store.listRuns(job.id)).toHaveLength(0);
  });

  it("returns undefined for a nonexistent job", () => {
    expect(store.getJob("does-not-exist")).toBeUndefined();
  });

  // ── getDueJobs ──────────────────────────────────────────────────────

  it("getDueJobs returns only due and enabled jobs", () => {
    // Create a job and manually backdate next_run_at so it is due
    const job = store.createJob(toolJob());
    store.updateJob(job.id, { next_run_at: Date.now() - 5000 });

    // Another job with next_run_at in the far future — not due
    const future = store.createJob(toolJob({ name: "Future Job" }));
    store.updateJob(future.id, { next_run_at: Date.now() + 60_000 });

    const due = store.getDueJobs();
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe(job.id);
  });

  it("excludes disabled jobs from getDueJobs", () => {
    const job = store.createJob(toolJob());
    // Backdate so it would be due
    store.updateJob(job.id, { next_run_at: Date.now() - 5000, enabled: false });

    expect(store.getDueJobs()).toHaveLength(0);
  });

  // ── Runs ────────────────────────────────────────────────────────────

  it("creates and updates a run", () => {
    const job = store.createJob(toolJob());
    const run = store.createRun(job.id);

    expect(run.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(run.job_id).toBe(job.id);
    expect(run.status).toBe("running");
    expect(run.started_at).toBeGreaterThan(0);
    expect(run.completed_at).toBeNull();

    store.updateRun(run.id, { status: "success", result: "done" });

    const runs = store.listRuns(job.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("success");
    expect(runs[0].result).toBe("done");
    // completed_at should be set now
    expect(runs[0].completed_at).toBeGreaterThan(0);
  });

  it("listRuns respects the default limit of 10", () => {
    const job = store.createJob(toolJob());

    // Insert 15 runs
    for (let i = 0; i < 15; i++) {
      const run = store.createRun(job.id);
      store.updateRun(run.id, { status: "success" });
    }

    const runs = store.listRuns(job.id);
    expect(runs).toHaveLength(10);
  });

  it("listRuns accepts a custom limit", () => {
    const job = store.createJob(toolJob());
    for (let i = 0; i < 5; i++) {
      store.createRun(job.id);
    }
    expect(store.listRuns(job.id, 3)).toHaveLength(3);
  });
});
