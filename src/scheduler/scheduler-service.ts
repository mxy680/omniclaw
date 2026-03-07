import { Cron } from "croner";
import { randomUUID } from "crypto";
import { ScheduleStore } from "./schedule-store.js";
import { ResultStore } from "./result-store.js";
import { GatewayClient, type GatewayConfig } from "./gateway-client.js";
import type { ScheduleJob, ScheduleRunResult } from "./types.js";
import { type AgentConfig, loadAgentSoul } from "../mcp/agent-config.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface SchedulerConfig {
  gateway: GatewayConfig;
  agentMap: Map<string, AgentConfig>;
  schedulesPath?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SchedulerService {
  private store: ScheduleStore;
  private resultStore: ResultStore;
  private gatewayClient: GatewayClient;
  private agentMap: Map<string, AgentConfig>;
  private cronJobs: Map<string, Cron> = new Map();
  private activeRuns: Map<string, ScheduleRunResult> = new Map();

  constructor(config: SchedulerConfig) {
    this.store = new ScheduleStore(config.schedulesPath);
    this.resultStore = new ResultStore();
    this.gatewayClient = new GatewayClient(config.gateway);
    this.agentMap = config.agentMap;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Load and schedule all enabled jobs. */
  start(): void {
    const { jobs } = this.store.load();
    console.log(`[scheduler] Loading ${jobs.length} scheduled job(s)`);

    for (const job of jobs) {
      if (job.enabled) {
        this.scheduleJob(job);
      }
    }
  }

  /** Stop all cron timers. */
  stop(): void {
    for (const [jobId, cron] of this.cronJobs) {
      cron.stop();
      console.log(`[scheduler] Stopped job: ${jobId}`);
    }
    this.cronJobs.clear();
  }

  /** Reload schedules from disk and re-schedule everything. */
  reload(): void {
    this.stop();
    this.start();
  }

  // -----------------------------------------------------------------------
  // Job management (public API for REST routes)
  // -----------------------------------------------------------------------

  getStore(): ScheduleStore {
    return this.store;
  }

  getResultStore(): ResultStore {
    return this.resultStore;
  }

  addJob(job: ScheduleJob): void {
    this.store.createJob(job);
    if (job.enabled) {
      this.scheduleJob(job);
    }
  }

  updateJob(jobId: string, updates: Partial<ScheduleJob>): ScheduleJob {
    const updated = this.store.updateJob(jobId, updates);
    // Re-schedule: stop old, start new if enabled
    const existing = this.cronJobs.get(jobId);
    if (existing) {
      existing.stop();
      this.cronJobs.delete(jobId);
    }
    if (updated.enabled) {
      this.scheduleJob(updated);
    }
    return updated;
  }

  deleteJob(jobId: string): void {
    const existing = this.cronJobs.get(jobId);
    if (existing) {
      existing.stop();
      this.cronJobs.delete(jobId);
    }
    this.store.deleteJob(jobId);
  }

  /** Manually trigger a job right now (fire-and-forget). */
  triggerJob(jobId: string): void {
    const job = this.store.getJob(jobId);
    if (!job) throw new Error(`Job "${jobId}" not found`);
    const agent = this.agentMap.get(job.agentId);
    if (!agent) throw new Error(`Agent "${job.agentId}" not found`);
    // Don't await — caller gets immediate response
    this.executeJob(job, agent).catch((err) => {
      console.error(`[scheduler] Manual trigger of "${jobId}" failed:`, err);
    });
  }

  getActiveRuns(): ScheduleRunResult[] {
    return Array.from(this.activeRuns.values());
  }

  getJobStatus(jobId: string): { nextRun: string | null; isRunning: boolean } {
    const cron = this.cronJobs.get(jobId);
    const isRunning = Array.from(this.activeRuns.values()).some((r) => r.jobId === jobId);
    return {
      nextRun: cron?.nextRun()?.toISOString() ?? null,
      isRunning,
    };
  }

  /** List recent runs across all agents and jobs (completed, error, and running). */
  listRecentRuns(since?: string, limit = 50): ScheduleRunResult[] {
    const sinceMs = since ? new Date(since).getTime() : 0;
    const allRuns: ScheduleRunResult[] = [];

    const { jobs } = this.store.load();
    for (const job of jobs) {
      const agent = this.agentMap.get(job.agentId);
      if (!agent) continue;
      const runs = this.resultStore.listRuns(agent.workspace, job.id);
      for (const run of runs) {
        // Enrich with job name if missing (for older results)
        if (!run.jobName) run.jobName = job.name;

        if (run.status === "running") {
          allRuns.push(run);
        } else if (run.completedAt && new Date(run.completedAt).getTime() > sinceMs) {
          allRuns.push(run);
        }
      }
    }

    // Also include in-memory active runs (not yet saved as completed)
    for (const run of this.activeRuns.values()) {
      if (!allRuns.some((r) => r.id === run.id)) {
        allRuns.push(run);
      }
    }

    allRuns.sort((a, b) => {
      const ta = a.completedAt ? new Date(a.completedAt).getTime() : a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const tb = b.completedAt ? new Date(b.completedAt).getTime() : b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return tb - ta;
    });

    return allRuns.slice(0, limit);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private scheduleJob(job: ScheduleJob): void {
    const existing = this.cronJobs.get(job.id);
    if (existing) existing.stop();

    const agent = this.agentMap.get(job.agentId);
    if (!agent) {
      console.warn(`[scheduler] Agent "${job.agentId}" not found for job "${job.id}" — skipping`);
      return;
    }

    const cron = new Cron(job.cron, { timezone: job.timezone, name: job.id }, () =>
      this.executeJob(job, agent),
    );

    this.cronJobs.set(job.id, cron);

    const nextRun = cron.nextRun();
    console.log(
      `[scheduler] Scheduled "${job.name}" (${job.id}) — cron: ${job.cron}, next: ${nextRun?.toISOString() ?? "never"}`,
    );
  }

  private async executeJob(job: ScheduleJob, agent: AgentConfig): Promise<void> {
    // Overlap prevention
    if (Array.from(this.activeRuns.values()).some((r) => r.jobId === job.id)) {
      console.warn(`[scheduler] Job "${job.id}" is already running — skipping`);
      return;
    }

    const runId = randomUUID();
    const startedAt = new Date().toISOString();

    console.log(`[scheduler] Executing "${job.name}" (${job.id}), run: ${runId}`);

    // Read instruction
    let instruction: string;
    try {
      instruction = this.store.readInstruction(job, agent.workspace);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[scheduler] Failed to read instruction for "${job.id}": ${errorMsg}`);
      this.resultStore.saveRun(agent.workspace, {
        id: runId,
        jobName: job.name,
        jobId: job.id,
        agentId: job.agentId,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "error",
        instruction: "",
        response: "",
        errorMessage: `Failed to read instruction file: ${errorMsg}`,
        durationMs: 0,
      });
      return;
    }

    // Track active run
    const run: ScheduleRunResult = {
      id: runId,
      jobId: job.id,
      jobName: job.name,
      agentId: job.agentId,
      startedAt,
      completedAt: null,
      status: "running",
      instruction,
      response: "",
    };
    this.activeRuns.set(runId, run);
    this.resultStore.saveRun(agent.workspace, run);

    // Prepend soul context if available
    const soul = loadAgentSoul(agent);
    const fullInstruction = soul
      ? `<agent-soul>\n${soul}\n</agent-soul>\n\n${instruction}`
      : instruction;

    // Execute via gateway
    const startTime = Date.now();
    try {
      const result = await this.gatewayClient.executeChat(job.agentId, fullInstruction, `${job.id}-${runId}`);
      run.response = result.response;
      run.status = "completed";
      run.completedAt = new Date().toISOString();
      run.durationMs = Date.now() - startTime;
      console.log(
        `[scheduler] "${job.name}" completed in ${run.durationMs}ms (${result.response.length} chars)`,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      run.status = "error";
      run.completedAt = new Date().toISOString();
      run.errorMessage = errorMsg;
      run.durationMs = Date.now() - startTime;
      console.error(`[scheduler] "${job.name}" failed: ${errorMsg}`);
    }

    this.resultStore.saveRun(agent.workspace, run);
    this.activeRuns.delete(runId);
  }
}
