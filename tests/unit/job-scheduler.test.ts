import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { JobStore } from "../../src/channel/job-store.js";
import { JobScheduler } from "../../src/channel/job-scheduler.js";

// Every-minute cron — next_run_at will always be in the future after creation
const EVERY_MINUTE = "* * * * *";
const TZ = "UTC";

function makeStore(dir: string): JobStore {
  return new JobStore(join(dir, "jobs.db"));
}

describe("JobScheduler", () => {
  let tmpDir: string;
  let store: JobStore;
  let executeTool: ReturnType<typeof vi.fn>;
  let dispatchAgentPrompt: ReturnType<typeof vi.fn>;
  let scheduler: JobScheduler;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "job-scheduler-test-"));
    store = makeStore(tmpDir);

    executeTool = vi.fn().mockResolvedValue({ ok: true });
    dispatchAgentPrompt = vi.fn().mockResolvedValue(undefined);

    scheduler = new JobScheduler({
      store,
      executeTool,
      dispatchAgentPrompt,
      tickIntervalMs: 60_000,
    });
  });

  afterEach(() => {
    scheduler.stop();
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ── Test 1: tool-mode job execution ─────────────────────────────────

  it("executes a due tool-mode job and records success", async () => {
    const job = store.createJob({
      name: "Tool Job",
      cron: EVERY_MINUTE,
      timezone: TZ,
      mode: "tool",
      tool_name: "gmail_list",
      tool_params: JSON.stringify({ limit: 5 }),
    });

    // Force the job to be due
    store.updateJob(job.id, { next_run_at: Date.now() - 60_000 });
    const dueBefore = Date.now();

    await scheduler.tick();

    // executeTool must have been called with the correct tool name and params
    expect(executeTool).toHaveBeenCalledOnce();
    const [calledTool, calledParams, calledRunId] = executeTool.mock.calls[0];
    expect(calledTool).toBe("gmail_list");
    expect(calledParams).toEqual({ limit: 5 });
    expect(typeof calledRunId).toBe("string");
    expect(calledRunId.length).toBeGreaterThan(0);

    // dispatchAgentPrompt must NOT have been called
    expect(dispatchAgentPrompt).not.toHaveBeenCalled();

    // The run record should exist with status "success"
    const runs = store.listRuns(job.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("success");
    expect(runs[0].id).toBe(calledRunId);
    expect(runs[0].completed_at).toBeGreaterThan(0);

    // next_run_at must have advanced (further in the future than dueBefore)
    const updated = store.getJob(job.id)!;
    expect(updated.next_run_at).toBeGreaterThan(dueBefore);

    // last_run_at and last_status must be set
    expect(updated.last_run_at).toBeGreaterThanOrEqual(dueBefore);
    expect(updated.last_status).toBe("success");
  });

  // ── Test 2: agent-mode job execution ────────────────────────────────

  it("executes a due agent-mode job and does not call executeTool", async () => {
    const job = store.createJob({
      name: "Agent Job",
      cron: EVERY_MINUTE,
      timezone: TZ,
      mode: "agent",
      prompt: "Summarize my emails",
    });

    store.updateJob(job.id, { next_run_at: Date.now() - 60_000 });

    await scheduler.tick();

    // dispatchAgentPrompt must have been called with the right prompt
    expect(dispatchAgentPrompt).toHaveBeenCalledOnce();
    const [calledPrompt, calledRunId] = dispatchAgentPrompt.mock.calls[0];
    expect(calledPrompt).toBe("Summarize my emails");
    expect(typeof calledRunId).toBe("string");

    // executeTool must NOT have been called
    expect(executeTool).not.toHaveBeenCalled();

    // Run should be marked success
    const runs = store.listRuns(job.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("success");

    // Job updated
    const updated = store.getJob(job.id)!;
    expect(updated.last_status).toBe("success");
    expect(updated.next_run_at).toBeGreaterThan(Date.now() - 5000);
  });

  // ── Test 3: tool execution failure ──────────────────────────────────

  it("records error when tool execution throws, and still advances next_run_at", async () => {
    executeTool.mockRejectedValueOnce(new Error("network timeout"));

    const job = store.createJob({
      name: "Failing Tool Job",
      cron: EVERY_MINUTE,
      timezone: TZ,
      mode: "tool",
      tool_name: "gmail_list",
      tool_params: null,
    });

    store.updateJob(job.id, { next_run_at: Date.now() - 60_000 });
    const before = Date.now();

    // tick() itself should NOT throw — errors are swallowed in executeJob
    await expect(scheduler.tick()).resolves.toBeUndefined();

    // Run should have status "error" with the error message in result
    const runs = store.listRuns(job.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("error");
    const result = JSON.parse(runs[0].result!);
    expect(result.error).toContain("network timeout");

    // next_run_at must still have been advanced despite the error
    const updated = store.getJob(job.id)!;
    expect(updated.next_run_at).toBeGreaterThan(before);

    // last_status reflects the error
    expect(updated.last_status).toBe("error");
    expect(updated.last_run_at).toBeGreaterThanOrEqual(before);
  });

  // ── Test 4: jobs not yet due are skipped ────────────────────────────

  it("does not execute jobs whose next_run_at is in the future", async () => {
    const job = store.createJob({
      name: "Future Job",
      cron: EVERY_MINUTE,
      timezone: TZ,
      mode: "tool",
      tool_name: "gmail_list",
    });

    // next_run_at is already set to the future by createJob — leave it
    expect(store.getDueJobs()).toHaveLength(0);

    await scheduler.tick();

    expect(executeTool).not.toHaveBeenCalled();
    expect(dispatchAgentPrompt).not.toHaveBeenCalled();
    expect(store.listRuns(job.id)).toHaveLength(0);
  });

  // ── Test 5: disabled jobs are skipped ───────────────────────────────

  it("does not execute disabled jobs even if they are past due", async () => {
    const job = store.createJob({
      name: "Disabled Job",
      cron: EVERY_MINUTE,
      timezone: TZ,
      mode: "tool",
      tool_name: "gmail_list",
    });

    // Backdate and disable
    store.updateJob(job.id, {
      next_run_at: Date.now() - 60_000,
      enabled: false,
    });

    await scheduler.tick();

    expect(executeTool).not.toHaveBeenCalled();
    expect(dispatchAgentPrompt).not.toHaveBeenCalled();
    expect(store.listRuns(job.id)).toHaveLength(0);
  });

  // ── Test 6: start/stop controls the interval ────────────────────────

  it("start/stop controls the setInterval timer", async () => {
    vi.useFakeTimers();

    const job = store.createJob({
      name: "Interval Job",
      cron: EVERY_MINUTE,
      timezone: TZ,
      mode: "tool",
      tool_name: "gmail_list",
    });
    store.updateJob(job.id, { next_run_at: Date.now() - 1 });

    // Before start(), advancing the clock should not trigger execution
    vi.advanceTimersByTime(60_000);
    expect(executeTool).not.toHaveBeenCalled();

    // After start(), the interval fires and executes due jobs
    scheduler.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(executeTool).toHaveBeenCalledOnce();

    // Calling start() a second time is a no-op (no duplicate timers)
    scheduler.start();
    // Re-backdate to ensure the job is due again
    store.updateJob(job.id, { next_run_at: Date.now() - 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    // Should be exactly 2 total calls (not 3), proving no duplicate timer
    expect(executeTool).toHaveBeenCalledTimes(2);

    // After stop(), the clock no longer triggers execution
    scheduler.stop();
    store.updateJob(job.id, { next_run_at: Date.now() - 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(executeTool).toHaveBeenCalledTimes(2); // Still 2

    vi.useRealTimers();
  });
});
