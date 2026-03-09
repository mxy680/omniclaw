import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubGistListTool(manager: GitHubClientManager): any {
  return {
    name: "github_gist_list",
    label: "GitHub List Gists",
    description: "List gists for the authenticated user.",
    parameters: Type.Object({
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { per_page?: number; page?: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.gists.list({
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((g) => ({
            id: g.id, description: g.description, public: g.public,
            files: Object.keys(g.files ?? {}), html_url: g.html_url,
            created_at: g.created_at, updated_at: g.updated_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubGistGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_gist_get",
    label: "GitHub Get Gist",
    description: "Get a gist by ID, including file contents.",
    parameters: Type.Object({
      gist_id: Type.String({ description: "Gist ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { gist_id: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.gists.get({ gist_id: params.gist_id });
        return jsonResult({
          id: data.id, description: data.description, public: data.public,
          files: Object.fromEntries(
            Object.entries(data.files ?? {}).map(([name, file]) => [
              name, { filename: file?.filename, language: file?.language, size: file?.size, content: file?.content },
            ]),
          ),
          html_url: data.html_url, created_at: data.created_at, updated_at: data.updated_at,
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubGistCreateTool(manager: GitHubClientManager): any {
  return {
    name: "github_gist_create",
    label: "GitHub Create Gist",
    description: "Create a new gist.",
    parameters: Type.Object({
      description: Type.Optional(Type.String({ description: "Gist description." })),
      public: Type.Optional(Type.Boolean({ description: "Whether the gist is public.", default: false })),
      files: Type.Record(
        Type.String(),
        Type.Object({ content: Type.String({ description: "File content." }) }),
        { description: "Files to include: { filename: { content: '...' } }" },
      ),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { description?: string; public?: boolean; files: Record<string, { content: string }>; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.gists.create({
          description: params.description, public: params.public ?? false, files: params.files,
        });
        return jsonResult({ id: data.id, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubGistUpdateTool(manager: GitHubClientManager): any {
  return {
    name: "github_gist_update",
    label: "GitHub Update Gist",
    description: "Update an existing gist.",
    parameters: Type.Object({
      gist_id: Type.String({ description: "Gist ID." }),
      description: Type.Optional(Type.String({ description: "New description." })),
      files: Type.Optional(
        Type.Record(
          Type.String(),
          Type.Object({ content: Type.String({ description: "File content." }) }),
          { description: "Files to update: { filename: { content: '...' } }" },
        ),
      ),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { gist_id: string; description?: string; files?: Record<string, { content: string }>; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.gists.update({
          gist_id: params.gist_id, description: params.description, files: params.files,
        });
        return jsonResult({ id: data.id, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubGistDeleteTool(manager: GitHubClientManager): any {
  return {
    name: "github_gist_delete",
    label: "GitHub Delete Gist",
    description: "Delete a gist.",
    parameters: Type.Object({
      gist_id: Type.String({ description: "Gist ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { gist_id: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.gists.delete({ gist_id: params.gist_id });
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
