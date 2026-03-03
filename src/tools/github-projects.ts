import { Type } from "@sinclair/typebox";
import type { GitHubClient } from "../auth/github-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// Classic Projects v1 API — uses octokit.request() since the typed
// .rest.projects methods were removed in newer @octokit/rest versions.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubProjectListTool(gh: GitHubClient): any {
  return {
    name: "github_project_list",
    label: "GitHub List Projects",
    description: "List classic (v1) projects for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")],
          { description: "Filter by state.", default: "open" },
        ),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; state?: string; per_page?: number; page?: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/projects", {
          owner: params.owner,
          repo: params.repo,
          state: (params.state as "open") ?? "open",
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return jsonResult((data as any[]).map((p: any) => ({
          id: p.id, name: p.name, body: p.body, state: p.state,
          html_url: p.html_url, created_at: p.created_at, updated_at: p.updated_at,
        })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubProjectGetTool(gh: GitHubClient): any {
  return {
    name: "github_project_get",
    label: "GitHub Get Project",
    description: "Get a classic (v1) project by ID.",
    parameters: Type.Object({
      project_id: Type.Number({ description: "Project ID." }),
    }),
    async execute(_toolCallId: string, params: { project_id: number }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.request("GET /projects/{project_id}", {
          project_id: params.project_id,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubProjectColumnsTool(gh: GitHubClient): any {
  return {
    name: "github_project_columns",
    label: "GitHub Project Columns",
    description: "List columns in a classic (v1) project.",
    parameters: Type.Object({
      project_id: Type.Number({ description: "Project ID." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: { project_id: number; per_page?: number; page?: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.request("GET /projects/{project_id}/columns", {
          project_id: params.project_id,
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return jsonResult((data as any[]).map((c: any) => ({
          id: c.id, name: c.name, created_at: c.created_at, updated_at: c.updated_at,
        })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubProjectCardsTool(gh: GitHubClient): any {
  return {
    name: "github_project_cards",
    label: "GitHub Project Cards",
    description: "List cards in a classic (v1) project column.",
    parameters: Type.Object({
      column_id: Type.Number({ description: "Column ID." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: { column_id: number; per_page?: number; page?: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.request("GET /projects/columns/{column_id}/cards", {
          column_id: params.column_id,
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return jsonResult((data as any[]).map((c: any) => ({
          id: c.id, note: c.note, content_url: c.content_url,
          created_at: c.created_at, updated_at: c.updated_at,
        })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
