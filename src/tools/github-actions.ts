import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult, authRequired, handleApiError } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubWorkflowListTool(manager: GitHubClientManager): any {
  return {
    name: "github_workflow_list",
    label: "GitHub List Workflows",
    description: "List GitHub Actions workflows for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.actions.listRepoWorkflows({
          owner: params.owner, repo: params.repo,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.workflows.map((w) => ({
            id: w.id, name: w.name, path: w.path, state: w.state,
            created_at: w.created_at, updated_at: w.updated_at, html_url: w.html_url,
          })),
        );
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubWorkflowGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_workflow_get",
    label: "GitHub Get Workflow",
    description: "Get details about a specific workflow.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      workflow_id: Type.Number({ description: "Workflow ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; workflow_id: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.actions.getWorkflow({
          owner: params.owner, repo: params.repo, workflow_id: params.workflow_id,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubWorkflowDispatchTool(manager: GitHubClientManager): any {
  return {
    name: "github_workflow_dispatch",
    label: "GitHub Dispatch Workflow",
    description: "Manually trigger a workflow run.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      workflow_id: Type.Number({ description: "Workflow ID." }),
      ref: Type.String({ description: "Branch or tag to run on." }),
      inputs: Type.Optional(
        Type.Record(Type.String(), Type.String(), { description: "Workflow input key-value pairs." }),
      ),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; workflow_id: number; ref: string; inputs?: Record<string, string>; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.actions.createWorkflowDispatch({
          owner: params.owner, repo: params.repo, workflow_id: params.workflow_id,
          ref: params.ref, inputs: params.inputs,
        });
        return jsonResult({ success: true, message: "Workflow dispatched." });
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRunListTool(manager: GitHubClientManager): any {
  return {
    name: "github_run_list",
    label: "GitHub List Workflow Runs",
    description: "List workflow runs for a repository, optionally filtered by workflow.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      workflow_id: Type.Optional(Type.Number({ description: "Filter by workflow ID." })),
      branch: Type.Optional(Type.String({ description: "Filter by branch." })),
      status: Type.Optional(
        Type.Union(
          [
            Type.Literal("completed"), Type.Literal("action_required"), Type.Literal("cancelled"),
            Type.Literal("failure"), Type.Literal("neutral"), Type.Literal("skipped"),
            Type.Literal("stale"), Type.Literal("success"), Type.Literal("timed_out"),
            Type.Literal("in_progress"), Type.Literal("queued"), Type.Literal("requested"),
            Type.Literal("waiting"), Type.Literal("pending"),
          ],
          { description: "Filter by status." },
        ),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string; repo: string; workflow_id?: number; branch?: string;
        status?: string; per_page?: number; page?: number; account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        let data;
        if (params.workflow_id) {
          const res = await octokit.rest.actions.listWorkflowRuns({
            owner: params.owner, repo: params.repo, workflow_id: params.workflow_id,
            branch: params.branch, status: params.status as "completed" | undefined,
            per_page: params.per_page ?? 30, page: params.page ?? 1,
          });
          data = res.data;
        } else {
          const res = await octokit.rest.actions.listWorkflowRunsForRepo({
            owner: params.owner, repo: params.repo,
            branch: params.branch, status: params.status as "completed" | undefined,
            per_page: params.per_page ?? 30, page: params.page ?? 1,
          });
          data = res.data;
        }
        return jsonResult(
          data.workflow_runs.map((r) => ({
            id: r.id, name: r.name, status: r.status, conclusion: r.conclusion,
            head_branch: r.head_branch, head_sha: r.head_sha.substring(0, 7),
            created_at: r.created_at, updated_at: r.updated_at, html_url: r.html_url,
          })),
        );
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRunGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_run_get",
    label: "GitHub Get Workflow Run",
    description: "Get details about a specific workflow run.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      run_id: Type.Number({ description: "Run ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; run_id: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.actions.getWorkflowRun({
          owner: params.owner, repo: params.repo, run_id: params.run_id,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRunCancelTool(manager: GitHubClientManager): any {
  return {
    name: "github_run_cancel",
    label: "GitHub Cancel Run",
    description: "Cancel a workflow run.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      run_id: Type.Number({ description: "Run ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; run_id: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.actions.cancelWorkflowRun({
          owner: params.owner, repo: params.repo, run_id: params.run_id,
        });
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRunRerunTool(manager: GitHubClientManager): any {
  return {
    name: "github_run_rerun",
    label: "GitHub Re-run Workflow",
    description: "Re-run a workflow.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      run_id: Type.Number({ description: "Run ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; run_id: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.actions.reRunWorkflow({
          owner: params.owner, repo: params.repo, run_id: params.run_id,
        });
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubJobListTool(manager: GitHubClientManager): any {
  return {
    name: "github_job_list",
    label: "GitHub List Jobs",
    description: "List jobs for a workflow run.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      run_id: Type.Number({ description: "Run ID." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; run_id: number; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.actions.listJobsForWorkflowRun({
          owner: params.owner, repo: params.repo, run_id: params.run_id,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.jobs.map((j) => ({
            id: j.id, name: j.name, status: j.status, conclusion: j.conclusion,
            started_at: j.started_at, completed_at: j.completed_at,
            steps: (j.steps ?? []).map((s) => ({ name: s.name, status: s.status, conclusion: s.conclusion })),
          })),
        );
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRunLogsTool(manager: GitHubClientManager): any {
  return {
    name: "github_run_logs",
    label: "GitHub Run Logs",
    description: "Get the download URL for workflow run logs.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      run_id: Type.Number({ description: "Run ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; run_id: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { url } = await octokit.rest.actions.downloadWorkflowRunLogs({
          owner: params.owner, repo: params.repo, run_id: params.run_id,
        });
        return jsonResult({ url });
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}
