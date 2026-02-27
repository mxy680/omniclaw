import { Type } from "@sinclair/typebox";
import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";
import { getProjectStore } from "../channel/channel-plugin.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function requireStore() {
  const store = getProjectStore();
  if (!store) throw new Error("Project store not initialized — iOS channel not running");
  return store;
}

const WORKSPACE_ROOT = join(homedir(), ".openclaw", "workspaces");

// ── Shell helpers ───────────────────────────────────────────────────

function exec(cmd: string, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("sh", ["-c", cmd], { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`Command failed (exit ${code}): ${cmd}\n${stderr}`));
      else resolve(stdout.trim());
    });
  });
}

// ── Session store ──────────────────────────────────────────────────

interface SessionEntry {
  sessionId: string;
  lastUsed: number;
}

interface SessionFile {
  [branch: string]: SessionEntry;
}

interface ClaudeJsonOutput {
  type: string;
  subtype: string;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost_usd: number;
}

function sessionFilePath(projectId: string): string {
  return join(WORKSPACE_ROOT, projectId, ".claude-sessions.json");
}

function loadSessions(projectId: string): SessionFile {
  try {
    const raw = readFileSync(sessionFilePath(projectId), "utf-8");
    return JSON.parse(raw) as SessionFile;
  } catch {
    return {};
  }
}

function saveSession(projectId: string, branch: string, sessionId: string): void {
  const filePath = sessionFilePath(projectId);
  mkdirSync(dirname(filePath), { recursive: true });
  const sessions = loadSessions(projectId);
  sessions[branch] = { sessionId, lastUsed: Date.now() };
  writeFileSync(filePath, JSON.stringify(sessions, null, 2));
}

function getSessionId(projectId: string, branch: string): string | null {
  const sessions = loadSessions(projectId);
  return sessions[branch]?.sessionId ?? null;
}

// ── Workspace management ────────────────────────────────────────────

/** Ensure workspace is cloned and on the default branch (for new sessions). */
async function ensureWorkspaceDefault(projectId: string, repoIdentifier: string): Promise<string> {
  const workspacePath = join(WORKSPACE_ROOT, projectId);
  const gitDir = join(workspacePath, ".git");

  if (existsSync(gitDir)) {
    const defaultBranch = await exec(
      "git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main",
      workspacePath,
    );
    await exec(`git fetch origin && git checkout ${defaultBranch} && git pull origin ${defaultBranch}`, workspacePath);
  } else {
    await mkdir(workspacePath, { recursive: true });
    await exec(`gh repo clone ${repoIdentifier} "${workspacePath}"`);
  }

  return workspacePath;
}

/** Ensure workspace is cloned and on an existing branch (for continuing sessions). */
async function ensureWorkspaceOnBranch(projectId: string, repoIdentifier: string, branch: string): Promise<string> {
  const workspacePath = join(WORKSPACE_ROOT, projectId);
  const gitDir = join(workspacePath, ".git");

  if (!existsSync(gitDir)) {
    await mkdir(workspacePath, { recursive: true });
    await exec(`gh repo clone ${repoIdentifier} "${workspacePath}"`);
  }

  // Fetch latest and checkout the branch
  await exec("git fetch origin", workspacePath);
  try {
    // Try local checkout first (branch already exists locally)
    await exec(`git checkout "${branch}"`, workspacePath);
    await exec(`git pull origin "${branch}"`, workspacePath);
  } catch {
    // Branch only on remote — create local tracking branch
    await exec(`git checkout -b "${branch}" "origin/${branch}"`, workspacePath);
  }

  return workspacePath;
}

// ── Claude Code runner ──────────────────────────────────────────────

function runClaude(
  instructions: string,
  cwd: string,
  opts?: { maxTurns?: number; resumeSessionId?: string },
): Promise<ClaudeJsonOutput> {
  return new Promise((resolve, reject) => {
    const args: string[] = [];

    if (opts?.resumeSessionId) {
      args.push("--resume", opts.resumeSessionId, "-p", instructions);
    } else {
      args.push("-p", instructions);
    }

    args.push("--output-format", "json", "--dangerously-skip-permissions");

    if (opts?.maxTurns) {
      args.push("--max-turns", String(opts.maxTurns));
    }

    // Remove CLAUDECODE env var to avoid "nested session" errors
    const cleanEnv = { ...process.env };
    delete cleanEnv.CLAUDECODE;

    const proc = spawn("claude", args, {
      cwd,
      env: cleanEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", (err) => reject(new Error(`Failed to spawn claude: ${err.message}`)));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}:\n${stderr || stdout}`));
      } else {
        try {
          const parsed = JSON.parse(stdout) as ClaudeJsonOutput;
          resolve(parsed);
        } catch {
          reject(new Error(`Failed to parse Claude JSON output:\n${stdout.slice(0, 2000)}`));
        }
      }
    });
  });
}

async function runClaudeWithFallback(
  instructions: string,
  cwd: string,
  opts?: { maxTurns?: number; resumeSessionId?: string },
): Promise<ClaudeJsonOutput> {
  if (opts?.resumeSessionId) {
    try {
      return await runClaude(instructions, cwd, opts);
    } catch {
      // Resume failed — fall back to a fresh session
      return runClaude(instructions, cwd, { maxTurns: opts.maxTurns });
    }
  }
  return runClaude(instructions, cwd, opts);
}

// ── Tool ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProjectCodeEditTool(): any {
  return {
    name: "project_code_edit",
    label: "Edit Project Code",
    description:
      "REQUIRED: The ONLY way to create, modify, or delete files in a project's GitHub repository. " +
      "Do NOT use shell commands (gh, git, curl), GitHub API calls, or any other method to change project code. " +
      "This tool clones/pulls the repo, creates a feature branch, runs Claude Code (Opus 4.6) with your instructions, " +
      "then commits and pushes the branch. Pass clear natural-language instructions describing what to change.",
    parameters: Type.Object({
      project_id: Type.String({ description: "ID of the project to edit" }),
      instructions: Type.String({
        description:
          "Natural-language instructions for Claude Code describing what changes to make",
      }),
      branch: Type.Optional(Type.String({
        description: "Existing branch to continue working on. If omitted, creates a new branch.",
      })),
    }),
    async execute(
      _toolCallId: string,
      params: { project_id: string; instructions: string; branch?: string },
    ) {
      const store = requireStore();
      const project = store.getProject(params.project_id);
      if (!project) {
        return jsonResult({ status: "error", error: `Project ${params.project_id} not found` });
      }

      const links = store.listLinks(project.id);
      const githubLink = links.find((l) => l.platform === "github");
      if (!githubLink) {
        return jsonResult({
          status: "error",
          error: `Project "${project.name}" has no linked GitHub repository`,
        });
      }

      // 1. Set up workspace and determine branch
      let workspacePath: string;
      let branchName: string;

      if (params.branch) {
        // Continue existing session — checkout the specified branch
        branchName = params.branch;
        try {
          workspacePath = await ensureWorkspaceOnBranch(project.id, githubLink.identifier, branchName);
        } catch (err) {
          return jsonResult({
            status: "error",
            error: `Failed to checkout branch "${branchName}": ${err}`,
          });
        }
      } else {
        // New session — start from default branch, create a new feature branch
        try {
          workspacePath = await ensureWorkspaceDefault(project.id, githubLink.identifier);
        } catch (err) {
          return jsonResult({
            status: "error",
            error: `Failed to set up workspace: ${err}`,
          });
        }

        const slug = params.instructions
          .slice(0, 40)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        branchName = `openclaw/${Date.now()}-${slug || "edit"}`;
        try {
          await exec(`git checkout -b "${branchName}"`, workspacePath);
        } catch (err) {
          return jsonResult({ status: "error", error: `Failed to create branch: ${err}` });
        }
      }

      // 2. Look up existing session for this branch
      const existingSessionId = params.branch ? getSessionId(project.id, branchName) : null;

      // 3. Run Claude Code
      const fullInstructions = [
        params.instructions,
        "",
        "When you are done, commit all changes with a descriptive commit message.",
      ].join("\n");

      let claudeResult: ClaudeJsonOutput;
      try {
        claudeResult = await runClaudeWithFallback(fullInstructions, workspacePath, {
          resumeSessionId: existingSessionId ?? undefined,
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: `Claude Code failed: ${err}`,
          branch: branchName,
        });
      }

      // 4. Persist session for future resume
      try {
        saveSession(project.id, branchName, claudeResult.session_id);
      } catch {
        // Non-fatal — next call just starts a fresh session
      }

      // 5. Push the branch (stay on branch for potential follow-up)
      try {
        await exec(`git push -u origin "${branchName}"`, workspacePath);
      } catch (err) {
        return jsonResult({
          status: "partial",
          error: `Changes committed locally but push failed: ${err}`,
          branch: branchName,
          session_id: claudeResult.session_id,
          num_turns: claudeResult.num_turns,
          cost_usd: claudeResult.total_cost_usd,
          duration_ms: claudeResult.duration_ms,
          workspace: workspacePath,
        });
      }

      const output = claudeResult.result;
      return jsonResult({
        status: "completed",
        project: project.name,
        repo: githubLink.identifier,
        branch: branchName,
        session_id: claudeResult.session_id,
        num_turns: claudeResult.num_turns,
        cost_usd: claudeResult.total_cost_usd,
        duration_ms: claudeResult.duration_ms,
        output: output.length > 8000 ? output.slice(-8000) : output,
      });
    },
  };
}
