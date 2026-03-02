import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ScheduleStore } from "../../src/scheduler/schedule-store.js";
import type { ScheduleJob } from "../../src/scheduler/types.js";

function tmpPath(): string {
  return path.join(os.tmpdir(), `schedule-store-test-${Date.now()}.json`);
}

function makeJob(overrides: Partial<ScheduleJob> = {}): ScheduleJob {
  const now = new Date().toISOString();
  return {
    id: "test-job",
    name: "Test Job",
    agentId: "markus",
    cron: "0 8 * * *",
    instructionFile: "test.md",
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("ScheduleStore", () => {
  let filePath: string;
  let store: ScheduleStore;

  beforeEach(() => {
    filePath = tmpPath();
    store = new ScheduleStore(filePath);
  });

  afterEach(() => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  it("returns empty jobs when file does not exist", () => {
    const data = store.load();
    expect(data.version).toBe(1);
    expect(data.jobs).toEqual([]);
  });

  it("creates and retrieves a job", () => {
    const job = makeJob();
    store.createJob(job);

    const retrieved = store.getJob("test-job");
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe("Test Job");
    expect(retrieved!.agentId).toBe("markus");
  });

  it("lists all jobs", () => {
    store.createJob(makeJob({ id: "a" }));
    store.createJob(makeJob({ id: "b" }));
    expect(store.listJobs()).toHaveLength(2);
  });

  it("throws on duplicate job id", () => {
    store.createJob(makeJob());
    expect(() => store.createJob(makeJob())).toThrow("already exists");
  });

  it("updates a job", () => {
    store.createJob(makeJob());
    const updated = store.updateJob("test-job", { name: "Updated", enabled: false });
    expect(updated.name).toBe("Updated");
    expect(updated.enabled).toBe(false);
    expect(updated.id).toBe("test-job");
  });

  it("throws when updating non-existent job", () => {
    expect(() => store.updateJob("nope", { name: "x" })).toThrow("not found");
  });

  it("deletes a job", () => {
    store.createJob(makeJob());
    expect(store.listJobs()).toHaveLength(1);
    store.deleteJob("test-job");
    expect(store.listJobs()).toHaveLength(0);
  });

  it("resolves relative instruction path", () => {
    const job = makeJob({ instructionFile: "morning.md" });
    const resolved = store.resolveInstructionPath(job, "/home/user/.openclaw/agents/markus");
    expect(resolved).toBe("/home/user/.openclaw/agents/markus/instructions/morning.md");
  });

  it("resolves absolute instruction path as-is", () => {
    const job = makeJob({ instructionFile: "/absolute/path/custom.md" });
    const resolved = store.resolveInstructionPath(job, "/irrelevant");
    expect(resolved).toBe("/absolute/path/custom.md");
  });

  it("reads instruction file from disk", () => {
    const dir = path.join(os.tmpdir(), `instr-test-${Date.now()}`);
    const instrDir = path.join(dir, "instructions");
    fs.mkdirSync(instrDir, { recursive: true });
    fs.writeFileSync(path.join(instrDir, "hello.md"), "# Hello\nDo the thing.");

    const job = makeJob({ instructionFile: "hello.md" });
    const content = store.readInstruction(job, dir);
    expect(content).toBe("# Hello\nDo the thing.");

    fs.rmSync(dir, { recursive: true });
  });
});
