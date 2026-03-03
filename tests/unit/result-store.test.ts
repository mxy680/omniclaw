import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ResultStore } from "../../src/scheduler/result-store.js";
import type { ScheduleRunResult } from "../../src/scheduler/types.js";

function makeRun(overrides: Partial<ScheduleRunResult> = {}): ScheduleRunResult {
  return {
    id: "run-1",
    jobId: "job-1",
    agentId: "markus",
    startedAt: "2026-03-02T08:00:00Z",
    completedAt: "2026-03-02T08:01:00Z",
    status: "completed",
    instruction: "Do the thing",
    response: "Done",
    durationMs: 60000,
    ...overrides,
  };
}

describe("ResultStore", () => {
  let workspace: string;
  let store: ResultStore;

  beforeEach(() => {
    workspace = path.join(os.tmpdir(), `result-store-test-${Date.now()}`);
    fs.mkdirSync(workspace, { recursive: true });
    store = new ResultStore();
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it("saves and retrieves a run", () => {
    const run = makeRun();
    store.saveRun(workspace, run);

    const retrieved = store.getRun(workspace, "job-1", "run-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.status).toBe("completed");
    expect(retrieved!.response).toBe("Done");
  });

  it("returns null for non-existent run", () => {
    expect(store.getRun(workspace, "nope", "nope")).toBeNull();
  });

  it("lists runs sorted newest first", () => {
    store.saveRun(workspace, makeRun({ id: "old", startedAt: "2026-03-01T00:00:00Z" }));
    store.saveRun(workspace, makeRun({ id: "new", startedAt: "2026-03-02T00:00:00Z" }));

    const runs = store.listRuns(workspace, "job-1");
    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe("new");
    expect(runs[1].id).toBe("old");
  });

  it("respects limit parameter", () => {
    store.saveRun(workspace, makeRun({ id: "a", startedAt: "2026-03-01T00:00:00Z" }));
    store.saveRun(workspace, makeRun({ id: "b", startedAt: "2026-03-02T00:00:00Z" }));
    store.saveRun(workspace, makeRun({ id: "c", startedAt: "2026-03-03T00:00:00Z" }));

    const runs = store.listRuns(workspace, "job-1", 2);
    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe("c");
  });

  it("returns empty array for non-existent job", () => {
    expect(store.listRuns(workspace, "nope")).toEqual([]);
  });

  it("getLatestRun returns the most recent", () => {
    store.saveRun(workspace, makeRun({ id: "old", startedAt: "2026-03-01T00:00:00Z" }));
    store.saveRun(workspace, makeRun({ id: "new", startedAt: "2026-03-02T00:00:00Z" }));

    const latest = store.getLatestRun(workspace, "job-1");
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe("new");
  });

  it("getLatestRun returns null when no runs exist", () => {
    expect(store.getLatestRun(workspace, "nope")).toBeNull();
  });

  it("overwrites run on re-save (e.g. status update)", () => {
    const run = makeRun({ status: "running", completedAt: null });
    store.saveRun(workspace, run);

    run.status = "completed";
    run.completedAt = "2026-03-02T08:01:00Z";
    store.saveRun(workspace, run);

    const retrieved = store.getRun(workspace, "job-1", "run-1");
    expect(retrieved!.status).toBe("completed");
  });
});
