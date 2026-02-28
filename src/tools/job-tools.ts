import { Type } from "@sinclair/typebox";
import { Cron } from "croner";
import { getJobStore, getJobScheduler } from "../channel/channel-plugin.js";
import { getWsServer } from "../channel/send.js";
import type { JobRow } from "../channel/job-store.js";
import type { WsJob } from "../channel/types.js";

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

function toWsJob(row: JobRow): WsJob {
  let toolParams: unknown = null;
  if (row.tool_params) {
    try {
      toolParams = JSON.parse(row.tool_params);
    } catch {
      toolParams = row.tool_params;
    }
  }
  return {
    id: row.id,
    name: row.name,
    cron: row.cron,
    timezone: row.timezone,
    mode: row.mode,
    toolName: row.tool_name,
    toolParams,
    prompt: row.prompt,
    enabled: Boolean(row.enabled),
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function broadcastJobUpdate(job: ReturnType<typeof toWsJob>) {
  const ws = getWsServer();
  if (ws) ws.broadcast({ type: "job_updated", job });
}

function validateCron(expr: string): void {
  try {
    new Cron(expr);
  } catch (err) {
    throw new Error(
      `Invalid cron expression "${expr}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ── job_create ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobCreateTool(): any {
  return {
    name: "job_create",
    label: "Create Job",
    description:
      "Create a scheduled cron job. Mode 'tool' calls a named tool with params on each run. " +
      "Mode 'agent' dispatches a natural-language prompt to the agent.",
    parameters: Type.Object({
      name: Type.String({ description: "Human-readable job name" }),
      cron: Type.String({
        description: "Cron expression (e.g. '0 9 * * 1' = every Monday at 9 AM)",
      }),
      timezone: Type.Optional(
        Type.String({
          description:
            "IANA timezone (e.g. 'America/New_York'). Defaults to the server's local timezone.",
        }),
      ),
      mode: Type.Union([Type.Literal("tool"), Type.Literal("agent")], {
        description: "Execution mode: 'tool' or 'agent'",
      }),
      tool_name: Type.Optional(
        Type.String({ description: "Tool name to call (required when mode is 'tool')" }),
      ),
      tool_params: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description: "Parameters to pass to the tool (mode 'tool' only)",
        }),
      ),
      prompt: Type.Optional(
        Type.String({ description: "Prompt to dispatch to the agent (required when mode is 'agent')" }),
      ),
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
      // Validate cron expression
      try {
        validateCron(params.cron);
      } catch (err) {
        return jsonResult({ status: "error", error: String(err) });
      }

      // Validate mode-specific fields
      if (params.mode === "tool" && !params.tool_name) {
        return jsonResult({
          status: "error",
          error: "tool_name is required when mode is 'tool'",
        });
      }
      if (params.mode === "agent" && !params.prompt) {
        return jsonResult({
          status: "error",
          error: "prompt is required when mode is 'agent'",
        });
      }

      const store = requireStore();
      const timezone = params.timezone ?? getLocalTimezone();

      let job;
      try {
        job = store.createJob({
          name: params.name,
          cron: params.cron,
          timezone,
          mode: params.mode,
          tool_name: params.tool_name,
          tool_params: params.tool_params ? JSON.stringify(params.tool_params) : undefined,
          prompt: params.prompt,
        });
      } catch (err) {
        return jsonResult({ status: "error", error: String(err) });
      }

      const wsJob = toWsJob(job);
      const ws = getWsServer();
      if (ws) ws.broadcast({ type: "job_created", job: wsJob });

      return jsonResult({ status: "created", job: wsJob });
    },
  };
}

// ── job_list ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobListTool(): any {
  return {
    name: "job_list",
    label: "List Jobs",
    description: "List all scheduled jobs, optionally filtered by enabled status.",
    parameters: Type.Object({
      enabled: Type.Optional(
        Type.Boolean({ description: "Filter by enabled (true) or disabled (false) jobs" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { enabled?: boolean },
    ) {
      const store = requireStore();
      const filter =
        params.enabled !== undefined ? { enabled: params.enabled } : undefined;
      const jobs = store.listJobs(filter).map(toWsJob);
      return jsonResult({ jobs });
    },
  };
}

// ── job_get ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobGetTool(): any {
  return {
    name: "job_get",
    label: "Get Job",
    description: "Get a single job by ID, including its recent run history.",
    parameters: Type.Object({
      job_id: Type.String({ description: "ID of the job to retrieve" }),
      run_limit: Type.Optional(
        Type.Number({ description: "Number of recent runs to include (default 10)" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { job_id: string; run_limit?: number },
    ) {
      const store = requireStore();
      const row = store.getJob(params.job_id);
      if (!row) {
        return jsonResult({ status: "error", error: `Job ${params.job_id} not found` });
      }
      const runs = store.listRuns(params.job_id, params.run_limit ?? 10);
      return jsonResult({ job: toWsJob(row), runs });
    },
  };
}

// ── job_update ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobUpdateTool(): any {
  return {
    name: "job_update",
    label: "Update Job",
    description:
      "Update a job's name, cron schedule, timezone, mode, tool, prompt, or enabled state.",
    parameters: Type.Object({
      job_id: Type.String({ description: "ID of the job to update" }),
      name: Type.Optional(Type.String({ description: "New job name" })),
      cron: Type.Optional(Type.String({ description: "New cron expression" })),
      timezone: Type.Optional(Type.String({ description: "New IANA timezone" })),
      mode: Type.Optional(
        Type.Union([Type.Literal("tool"), Type.Literal("agent")], {
          description: "New execution mode",
        }),
      ),
      tool_name: Type.Optional(Type.String({ description: "New tool name" })),
      tool_params: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description: "New tool parameters",
        }),
      ),
      prompt: Type.Optional(Type.String({ description: "New agent prompt" })),
      enabled: Type.Optional(Type.Boolean({ description: "Enable or disable the job" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        job_id: string;
        name?: string;
        cron?: string;
        timezone?: string;
        mode?: "tool" | "agent";
        tool_name?: string;
        tool_params?: Record<string, unknown>;
        prompt?: string;
        enabled?: boolean;
      },
    ) {
      const store = requireStore();
      const existing = store.getJob(params.job_id);
      if (!existing) {
        return jsonResult({ status: "error", error: `Job ${params.job_id} not found` });
      }

      // Validate cron if provided
      if (params.cron !== undefined) {
        try {
          validateCron(params.cron);
        } catch (err) {
          return jsonResult({ status: "error", error: String(err) });
        }
      }

      try {
        store.updateJob(params.job_id, {
          name: params.name,
          cron: params.cron,
          timezone: params.timezone,
          mode: params.mode,
          tool_name: params.tool_name !== undefined ? params.tool_name : undefined,
          tool_params:
            params.tool_params !== undefined
              ? JSON.stringify(params.tool_params)
              : undefined,
          prompt: params.prompt,
          enabled: params.enabled,
        });
      } catch (err) {
        return jsonResult({ status: "error", error: String(err) });
      }

      const updated = store.getJob(params.job_id)!;
      const wsJob = toWsJob(updated);
      broadcastJobUpdate(wsJob);

      return jsonResult({ status: "updated", job: wsJob });
    },
  };
}

// ── job_delete ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobDeleteTool(): any {
  return {
    name: "job_delete",
    label: "Delete Job",
    description: "Delete a job and all its run history by ID.",
    parameters: Type.Object({
      job_id: Type.String({ description: "ID of the job to delete" }),
    }),
    async execute(
      _toolCallId: string,
      params: { job_id: string },
    ) {
      const store = requireStore();
      const existing = store.getJob(params.job_id);
      if (!existing) {
        return jsonResult({ status: "error", error: `Job ${params.job_id} not found` });
      }

      store.deleteJob(params.job_id);

      const ws = getWsServer();
      if (ws) ws.broadcast({ type: "job_deleted", jobId: params.job_id });

      return jsonResult({ status: "deleted", jobId: params.job_id });
    },
  };
}

// ── job_run_now ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJobRunNowTool(): any {
  return {
    name: "job_run_now",
    label: "Run Job Now",
    description:
      "Immediately trigger a job outside its normal schedule. " +
      "Does not advance next_run_at — the job will still run at its next scheduled time.",
    parameters: Type.Object({
      job_id: Type.String({ description: "ID of the job to run immediately" }),
    }),
    async execute(
      _toolCallId: string,
      params: { job_id: string },
    ) {
      const store = requireStore();
      const scheduler = getJobScheduler();
      if (!scheduler) {
        return jsonResult({
          status: "error",
          error: "Job scheduler not initialized — iOS channel not running",
        });
      }

      const job = store.getJob(params.job_id);
      if (!job) {
        return jsonResult({ status: "error", error: `Job ${params.job_id} not found` });
      }

      try {
        await scheduler.runJob(job);
      } catch (err) {
        // runJob already recorded the error in the DB; return it to the caller too.
        const updated = store.getJob(params.job_id)!;
        const runs = store.listRuns(params.job_id, 1);
        return jsonResult({
          status: "error",
          error: String(err),
          job: toWsJob(updated),
          lastRun: runs[0] ?? null,
        });
      }

      const updated = store.getJob(params.job_id)!;
      const runs = store.listRuns(params.job_id, 1);
      const wsJob = toWsJob(updated);
      broadcastJobUpdate(wsJob);

      return jsonResult({ status: "success", job: wsJob, lastRun: runs[0] ?? null });
    },
  };
}
