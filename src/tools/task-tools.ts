import { Type } from "@sinclair/typebox";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { getTaskStore } from "../channel/channel-plugin.js";
import { toWsTask } from "../channel/task-types.js";
import { getWsServer } from "../channel/send.js";
import { exec, runClaudeWithFallback } from "./project-code-tools.js";
import type { TaskStatus } from "../channel/task-store.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function requireStore() {
  const store = getTaskStore();
  if (!store) throw new Error("Task store not initialized — iOS channel not running");
  return store;
}

function broadcastTaskUpdate(task: ReturnType<typeof toWsTask>) {
  const ws = getWsServer();
  if (ws) ws.broadcast({ type: "task_updated", task });
}

// ── task_create ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTaskCreateTool(): any {
  return {
    name: "task_create",
    label: "Create Task",
    description:
      "Create a new task. Tasks can target 'self' (this agent/plugin) or a project ID. " +
      "Self-targeting tasks enable self-evolution: the agent proposes improvements, " +
      "and once approved + executed, changes are built, tested, merged, and hot-reloaded.",
    parameters: Type.Object({
      title: Type.String({ description: "Short task title" }),
      description: Type.String({ description: "Detailed description of the task / what to change" }),
      priority: Type.Optional(
        Type.Union([
          Type.Literal("low"),
          Type.Literal("medium"),
          Type.Literal("high"),
          Type.Literal("critical"),
        ], { description: "Task priority. Defaults to 'medium'." }),
      ),
      source: Type.Optional(
        Type.String({ description: "Who created this task. Defaults to 'agent'." }),
      ),
      target: Type.Optional(
        Type.String({
          description:
            "Target: 'self' for this plugin, or a project_id for external projects. Defaults to 'self'.",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        title: string;
        description: string;
        priority?: string;
        source?: string;
        target?: string;
      },
    ) {
      const store = requireStore();
      const id = randomUUID();
      const row = store.createTask(id, params.title, params.description, {
        priority: (params.priority as "low" | "medium" | "high" | "critical") ?? "medium",
        source: params.source ?? "agent",
        target: params.target ?? "self",
      });

      const wsTask = toWsTask(row);
      const ws = getWsServer();
      if (ws) ws.broadcast({ type: "task_created", task: wsTask });

      return jsonResult({ status: "created", task: wsTask });
    },
  };
}

// ── task_list ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTaskListTool(): any {
  return {
    name: "task_list",
    label: "List Tasks",
    description: "List all tasks, optionally filtered by status.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.Union([
          Type.Literal("proposed"),
          Type.Literal("approved"),
          Type.Literal("in_progress"),
          Type.Literal("testing"),
          Type.Literal("completed"),
          Type.Literal("failed"),
        ], { description: "Filter by status" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { status?: string },
    ) {
      const store = requireStore();
      const filter = params.status
        ? { status: params.status as TaskStatus }
        : undefined;
      const tasks = store.listTasks(filter).map(toWsTask);
      return jsonResult({ tasks });
    },
  };
}

// ── task_get ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTaskGetTool(): any {
  return {
    name: "task_get",
    label: "Get Task",
    description: "Get a single task by ID.",
    parameters: Type.Object({
      task_id: Type.String({ description: "ID of the task to retrieve" }),
    }),
    async execute(
      _toolCallId: string,
      params: { task_id: string },
    ) {
      const store = requireStore();
      const row = store.getTask(params.task_id);
      if (!row) {
        return jsonResult({ status: "error", error: `Task ${params.task_id} not found` });
      }
      return jsonResult({ task: toWsTask(row) });
    },
  };
}

// ── task_update ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTaskUpdateTool(): any {
  return {
    name: "task_update",
    label: "Update Task",
    description: "Update a task's title, description, status, or priority.",
    parameters: Type.Object({
      task_id: Type.String({ description: "ID of the task to update" }),
      title: Type.Optional(Type.String({ description: "New title" })),
      description: Type.Optional(Type.String({ description: "New description" })),
      status: Type.Optional(
        Type.Union([
          Type.Literal("proposed"),
          Type.Literal("approved"),
          Type.Literal("in_progress"),
          Type.Literal("testing"),
          Type.Literal("completed"),
          Type.Literal("failed"),
        ], { description: "New status" }),
      ),
      priority: Type.Optional(
        Type.Union([
          Type.Literal("low"),
          Type.Literal("medium"),
          Type.Literal("high"),
          Type.Literal("critical"),
        ], { description: "New priority" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        task_id: string;
        title?: string;
        description?: string;
        status?: string;
        priority?: string;
      },
    ) {
      const store = requireStore();
      const existing = store.getTask(params.task_id);
      if (!existing) {
        return jsonResult({ status: "error", error: `Task ${params.task_id} not found` });
      }

      store.updateTask(params.task_id, {
        title: params.title,
        description: params.description,
        status: params.status as TaskStatus | undefined,
        priority: params.priority as "low" | "medium" | "high" | "critical" | undefined,
      });

      const updated = store.getTask(params.task_id)!;
      const wsTask = toWsTask(updated);
      broadcastTaskUpdate(wsTask);

      return jsonResult({ status: "updated", task: wsTask });
    },
  };
}

// ── task_delete ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTaskDeleteTool(): any {
  return {
    name: "task_delete",
    label: "Delete Task",
    description: "Delete a task by ID.",
    parameters: Type.Object({
      task_id: Type.String({ description: "ID of the task to delete" }),
    }),
    async execute(
      _toolCallId: string,
      params: { task_id: string },
    ) {
      const store = requireStore();
      const existing = store.getTask(params.task_id);
      if (!existing) {
        return jsonResult({ status: "error", error: `Task ${params.task_id} not found` });
      }

      store.deleteTask(params.task_id);

      const ws = getWsServer();
      if (ws) ws.broadcast({ type: "task_deleted", taskId: params.task_id });

      return jsonResult({ status: "deleted", taskId: params.task_id });
    },
  };
}

// ── task_execute (self-evolution engine) ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTaskExecuteTool(): any {
  return {
    name: "task_execute",
    label: "Execute Task",
    description:
      "Execute an approved task. For 'self' tasks: creates a branch, spawns Claude Code, " +
      "runs build + tests, merges to main if green, then hot-reloads. " +
      "For project tasks: delegates to the project_code_edit flow.",
    parameters: Type.Object({
      task_id: Type.String({ description: "ID of the task to execute" }),
    }),
    async execute(
      _toolCallId: string,
      params: { task_id: string },
    ) {
      const store = requireStore();
      const task = store.getTask(params.task_id);
      if (!task) {
        return jsonResult({ status: "error", error: `Task ${params.task_id} not found` });
      }
      if (task.status !== "approved") {
        return jsonResult({
          status: "error",
          error: `Task must be 'approved' to execute (current: '${task.status}')`,
        });
      }

      // Check no other task is in_progress
      const inProgress = store.listTasks({ status: "in_progress" });
      if (inProgress.length > 0) {
        return jsonResult({
          status: "error",
          error: `Another task is already in progress: "${inProgress[0].title}" (${inProgress[0].id})`,
        });
      }

      if (task.target === "self" || !task.target) {
        return executeSelfTask(store, task);
      } else {
        return executeProjectTask(store, task);
      }
    },
  };
}

/** Shared execution logic exposed for WebSocket handlers. */
export { executeSelfTask, executeProjectTask };

async function executeSelfTask(
  store: ReturnType<typeof requireStore>,
  task: NonNullable<ReturnType<ReturnType<typeof requireStore>["getTask"]>>,
) {
  // Detect omniclaw repo root from this file's location
  const thisFile = fileURLToPath(import.meta.url);
  const repoRoot = resolve(dirname(thisFile), "..", "..");

  // Mark in_progress
  store.updateTask(task.id, { status: "in_progress", error: null });
  const progressTask = store.getTask(task.id)!;
  broadcastTaskUpdate(toWsTask(progressTask));

  let stashed = false;

  try {
    // Stash any uncommitted work
    const stashOutput = await exec("git stash --include-untracked", repoRoot);
    stashed = !stashOutput.includes("No local changes");

    // Ensure we're on main and up-to-date
    await exec("git checkout main && git pull origin main", repoRoot);

    // Create feature branch
    const slug = task.title
      .slice(0, 40)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const branch = `evolve/${Date.now()}-${slug || "task"}`;
    await exec(`git checkout -b "${branch}"`, repoRoot);

    store.updateTask(task.id, { branch });
    broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));

    // Run Claude Code
    const instructions = [
      task.description,
      "",
      "When you are done, commit all changes with a descriptive commit message.",
      "Do NOT push — the orchestrator handles merging.",
    ].join("\n");

    let claudeResult;
    try {
      claudeResult = await runClaudeWithFallback(instructions, repoRoot, {
        resumeSessionId: task.session_id ?? undefined,
      });
    } catch (err) {
      store.updateTask(task.id, {
        status: "failed",
        error: `Claude Code failed: ${err}`,
        session_id: undefined,
      });
      broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));
      await exec("git checkout main", repoRoot);
      return jsonResult({ status: "failed", error: `Claude Code failed: ${err}` });
    }

    store.updateTask(task.id, {
      session_id: claudeResult.session_id,
      cost_usd: claudeResult.total_cost_usd,
    });

    // Testing phase
    store.updateTask(task.id, { status: "testing" });
    broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));

    // Build
    try {
      await exec("pnpm build", repoRoot);
    } catch (err) {
      store.updateTask(task.id, {
        status: "failed",
        error: `Build failed: ${err}`,
      });
      broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));
      await exec("git checkout main", repoRoot);
      return jsonResult({ status: "failed", error: `Build failed on branch: ${err}` });
    }

    // Unit tests
    try {
      await exec("pnpm vitest run tests/unit", repoRoot);
    } catch (err) {
      store.updateTask(task.id, {
        status: "failed",
        error: `Tests failed: ${err}`,
      });
      broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));
      await exec("git checkout main", repoRoot);
      return jsonResult({ status: "failed", error: `Tests failed: ${err}` });
    }

    // Merge to main
    await exec(`git checkout main && git merge "${branch}" --no-ff -m "feat(evolve): ${task.title}"`, repoRoot);

    // Post-merge build check
    try {
      await exec("pnpm build", repoRoot);
    } catch (err) {
      // Revert the merge
      await exec("git revert HEAD --no-edit", repoRoot);
      store.updateTask(task.id, {
        status: "failed",
        error: `Post-merge build failed (reverted): ${err}`,
      });
      broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));
      return jsonResult({ status: "failed", error: `Post-merge build failed (reverted): ${err}` });
    }

    // Success
    store.updateTask(task.id, {
      status: "completed",
      completed_at: Date.now(),
      error: null,
    });
    broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));

    // Schedule hot reload
    setTimeout(() => process.exit(0), 500);

    return jsonResult({
      status: "completed",
      branch,
      session_id: claudeResult.session_id,
      cost_usd: claudeResult.total_cost_usd,
      duration_ms: claudeResult.duration_ms,
      message: "Changes merged to main. Hot-reloading in 500ms.",
    });
  } finally {
    // Pop stash if we stashed
    if (stashed) {
      try {
        await exec("git stash pop", repoRoot);
      } catch {
        // Best-effort — conflicts may need manual resolution
      }
    }
  }
}

async function executeProjectTask(
  store: ReturnType<typeof requireStore>,
  task: NonNullable<ReturnType<ReturnType<typeof requireStore>["getTask"]>>,
) {
  // For project tasks, we need access to the project store
  const { getProjectStore } = await import("../channel/channel-plugin.js");
  const projectStore = getProjectStore();
  if (!projectStore) {
    return jsonResult({ status: "error", error: "Project store not initialized" });
  }

  const project = projectStore.getProject(task.target!);
  if (!project) {
    return jsonResult({ status: "error", error: `Project ${task.target} not found` });
  }

  const links = projectStore.listLinks(project.id);
  const githubLink = links.find((l) => l.platform === "github");
  if (!githubLink) {
    return jsonResult({
      status: "error",
      error: `Project "${project.name}" has no linked GitHub repository`,
    });
  }

  // Mark in_progress
  store.updateTask(task.id, { status: "in_progress", error: null });
  broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));

  // Delegate to Claude Code (similar to project_code_edit)
  const { homedir } = await import("os");
  const { join } = await import("path");
  const { existsSync } = await import("fs");
  const { mkdir } = await import("fs/promises");

  const WORKSPACE_ROOT = join(homedir(), ".openclaw", "workspaces");
  const workspacePath = join(WORKSPACE_ROOT, project.id);
  const gitDir = join(workspacePath, ".git");

  try {
    if (existsSync(gitDir)) {
      const defaultBranch = await exec(
        "git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main",
        workspacePath,
      );
      await exec(`git fetch origin && git checkout ${defaultBranch} && git pull origin ${defaultBranch}`, workspacePath);
    } else {
      await mkdir(workspacePath, { recursive: true });
      await exec(`gh repo clone ${githubLink.identifier} "${workspacePath}"`);
    }

    const slug = task.title
      .slice(0, 40)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const branch = `openclaw/${Date.now()}-${slug || "task"}`;
    await exec(`git checkout -b "${branch}"`, workspacePath);

    store.updateTask(task.id, { branch });
    broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));

    const instructions = [
      task.description,
      "",
      "When you are done, commit all changes with a descriptive commit message.",
    ].join("\n");

    const claudeResult = await runClaudeWithFallback(instructions, workspacePath, {
      resumeSessionId: task.session_id ?? undefined,
    });

    store.updateTask(task.id, {
      session_id: claudeResult.session_id,
      cost_usd: claudeResult.total_cost_usd,
    });

    // Push branch
    await exec(`git push -u origin "${branch}"`, workspacePath);

    store.updateTask(task.id, {
      status: "completed",
      completed_at: Date.now(),
      error: null,
    });
    broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));

    return jsonResult({
      status: "completed",
      project: project.name,
      branch,
      session_id: claudeResult.session_id,
      cost_usd: claudeResult.total_cost_usd,
      duration_ms: claudeResult.duration_ms,
    });
  } catch (err) {
    store.updateTask(task.id, {
      status: "failed",
      error: String(err),
    });
    broadcastTaskUpdate(toWsTask(store.getTask(task.id)!));
    return jsonResult({ status: "failed", error: String(err) });
  }
}
