import { computeNextRun, type JobStore, type JobRow } from "./job-store.js";

export type JobSchedulerConfig = {
  store: JobStore;
  executeTool: (
    toolName: string,
    params: Record<string, unknown>,
    runId: string,
  ) => Promise<unknown>;
  dispatchAgentPrompt: (prompt: string, runId: string) => Promise<void>;
  tickIntervalMs?: number;
};

export class JobScheduler {
  private store: JobStore;
  private executeTool: JobSchedulerConfig["executeTool"];
  private dispatchAgentPrompt: JobSchedulerConfig["dispatchAgentPrompt"];
  private tickIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private runningJobs = new Set<string>();

  constructor(config: JobSchedulerConfig) {
    this.store = config.store;
    this.executeTool = config.executeTool;
    this.dispatchAgentPrompt = config.dispatchAgentPrompt;
    this.tickIntervalMs = config.tickIntervalMs ?? 60_000;
  }

  /** Start the periodic tick loop. Idempotent — safe to call multiple times. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.error("[JobScheduler] tick error:", err);
      });
    }, this.tickIntervalMs);
  }

  /** Stop the periodic tick loop. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Run one tick: find all due jobs and execute them in order. */
  async tick(): Promise<void> {
    const dueJobs = this.store.getDueJobs();
    for (const job of dueJobs) {
      await this.executeJob(job);
    }
  }

  /**
   * Execute a job immediately (e.g., from a job_run_now tool call).
   * Does NOT advance next_run_at — that is only done by the scheduler tick.
   * Throws if the underlying execution fails, so callers can surface the error.
   */
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
      // Re-throw so the caller (e.g. a tool handler) can report the failure.
      throw err;
    }
  }

  /**
   * Internal execution path for scheduler-driven runs.
   * Always advances next_run_at regardless of success/failure.
   * Never throws — errors are recorded in the run row and the job is updated.
   */
  private async executeJob(job: JobRow): Promise<void> {
    if (this.runningJobs.has(job.id)) return;
    this.runningJobs.add(job.id);

    const run = this.store.createRun(job.id);

    try {
      if (job.mode === "tool" && job.tool_name) {
        const params = job.tool_params ? JSON.parse(job.tool_params) : {};
        await this.executeTool(job.tool_name, params, run.id);
      } else if (job.mode === "agent" && job.prompt) {
        await this.dispatchAgentPrompt(job.prompt, run.id);
      } else {
        throw new Error(
          `Invalid job config: mode=${job.mode}, tool_name=${job.tool_name}, prompt=${job.prompt}`,
        );
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

    // Always advance next_run_at so the job doesn't fire again immediately.
    // If the cron expression is somehow broken, disable the job to prevent loops.
    try {
      const nextRun = computeNextRun(job.cron, job.timezone);
      this.store.updateJob(job.id, { next_run_at: nextRun });
    } catch {
      this.store.updateJob(job.id, { enabled: false });
    } finally {
      this.runningJobs.delete(job.id);
    }
  }
}
