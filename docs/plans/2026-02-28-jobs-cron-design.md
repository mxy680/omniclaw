# Jobs (Cron) System Design

## Overview

Add a "jobs" capability to omniclaw — scheduled cron jobs configurable through conversation with the agent. Supports two modes: direct tool execution (fixed tool + params) and agent-driven tasks (natural language prompts dispatched to the agent).

## Decisions

- **Runtime**: Scheduler runs inside the channel plugin process (alongside DispatchManager, TaskStore, etc.). Jobs only run when the plugin is active.
- **Job modes**: Both "tool" (direct tool call, no LLM) and "agent" (natural language prompt, requires LLM inference).
- **Output**: Push notification only — results stored in job run history, broadcast via WebSocket. No dedicated conversation threads.
- **Management**: Agent-only for now — no dashboard UI. Can add a read-only or full dashboard page later.
- **Approach**: SQLite store + in-process scheduler with 60-second tick loop. Reuses DispatchManager for agent mode concurrency control.

## Data Model

SQLite database at `~/.openclaw/omniclaw-jobs.db` (configurable via `jobs_db_path` in PluginConfig).

### `jobs` table

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | Human-readable name (e.g., "Morning inbox check") |
| `cron` | TEXT NOT NULL | Cron expression (e.g., `0 8 * * *`) |
| `timezone` | TEXT NOT NULL | IANA timezone, defaults to system local |
| `mode` | TEXT NOT NULL | `"tool"` or `"agent"` |
| `tool_name` | TEXT | For tool mode: which tool to call |
| `tool_params` | TEXT | For tool mode: JSON-encoded params |
| `prompt` | TEXT | For agent mode: natural language prompt |
| `enabled` | INTEGER NOT NULL | 1 = active, 0 = paused |
| `next_run_at` | INTEGER | Epoch ms of next scheduled run |
| `last_run_at` | INTEGER | Epoch ms of last execution |
| `last_status` | TEXT | `"success"` or `"error"` |
| `created_at` | INTEGER NOT NULL | |
| `updated_at` | INTEGER NOT NULL | |

Indices: `(enabled, next_run_at)`.

### `job_runs` table

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID |
| `job_id` | TEXT NOT NULL | References jobs.id |
| `started_at` | INTEGER NOT NULL | |
| `completed_at` | INTEGER | |
| `status` | TEXT NOT NULL | `"running"`, `"success"`, `"error"` |
| `result` | TEXT | JSON output or error message |

Indices: `(job_id, started_at DESC)`.

## Components

### JobStore (`src/channel/job-store.ts`)

SQLite CRUD store following the TaskStore pattern:
- Constructor takes optional `dbPath`, creates dir, opens SQLite with WAL mode, runs `migrate()`.
- Methods: `createJob`, `getJob`, `listJobs`, `updateJob`, `deleteJob`, `getDueJobs`, `createRun`, `updateRun`, `listRuns(jobId, limit)`.
- `getDueJobs()` returns all jobs where `enabled = 1 AND next_run_at <= Date.now()`.

### JobScheduler (`src/channel/job-scheduler.ts`)

In-process scheduler with a 60-second tick loop:
- Constructed with JobStore + callbacks for tool execution and agent dispatch.
- Each tick: queries `getDueJobs()`, for each:
  - Creates a `job_run` record with status `"running"`.
  - Tool mode: looks up tool by name, calls `tool.execute(runId, params)`.
  - Agent mode: calls dispatch callback to submit prompt as background task.
  - Updates run to `"success"` or `"error"`, records result.
  - Computes `next_run_at` from cron expression and updates the job.
- `start()` / `stop()` methods to control the interval.
- Uses `croner` library for cron parsing + next-run computation (lightweight, zero deps, timezone support).

### Tools (`src/tools/job-tools.ts`)

Six tools in a single file (matching `task-tools.ts` pattern):

| Tool | Params | Description |
|---|---|---|
| `job_create` | `name`, `cron`, `timezone?`, `mode`, `tool_name?`, `tool_params?`, `prompt?` | Create a scheduled job. Validates cron, computes next_run_at. |
| `job_list` | `enabled?` | List all jobs with next/last run info. |
| `job_get` | `id`, `run_limit?` | Get job details + last N runs (default 10). |
| `job_update` | `id`, `name?`, `cron?`, `timezone?`, `tool_name?`, `tool_params?`, `prompt?`, `enabled?` | Update job. Recomputes next_run_at if cron changes. |
| `job_delete` | `id` | Delete job and run history. |
| `job_run_now` | `id` | Trigger immediately. Does not affect next scheduled time. |

All tools use `jsonResult()` and broadcast `{ type: "job_updated", job }` via WebSocket.

## Integration

### Channel Plugin (`channel-plugin.ts`)
- New singletons: `activeJobStore`, `activeJobScheduler` with `getJobStore()` / `getJobScheduler()` accessors.
- `startAccount`: instantiate JobStore, instantiate JobScheduler with callbacks:
  - `executeTool(name, params)` — looks up tool from registry, calls execute.
  - `dispatchAgentPrompt(prompt)` — submits to DispatchManager with `priority: "background"`.
- `stop`: call `scheduler.stop()`, `jobStore.close()`, null out singletons.

### Tool Registry (`tool-registry.ts`)
- Import and register the 6 job tools unconditionally alongside task tools.

### Plugin Config (`plugin-config.ts`)
- Add `jobs_db_path?: string` to PluginConfig.

### Dependencies
- Add `croner` to `package.json`.
