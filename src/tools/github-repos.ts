import { writeFileSync } from "fs";
import { join } from "path";
import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { ensureDir, sanitizeFilename } from "./media-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const GITHUB_AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call github_auth_setup with your GitHub Personal Access Token.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubReposTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_repos",
    label: "GitHub Repos",
    description: "List repositories for the authenticated user.",
    parameters: Type.Object({
      type: Type.Optional(
        Type.String({
          description: "Filter: 'all', 'owner', 'public', 'private', 'member'. Defaults to 'all'.",
          default: "all",
        }),
      ),
      sort: Type.Optional(
        Type.String({
          description:
            "Sort by: 'created', 'updated', 'pushed', 'full_name'. Defaults to 'updated'.",
          default: "updated",
        }),
      ),
      per_page: Type.Optional(
        Type.String({
          description: "Results per page (max 100). Defaults to '30'.",
          default: "30",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { type?: string; sort?: string; per_page?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.type) qp.type = params.type;
        if (params.sort) qp.sort = params.sort;
        if (params.per_page) qp.per_page = params.per_page;
        const repos = await ghManager.get(account, "user/repos", qp);
        return jsonResult(repos);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubGetRepoTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_get_repo",
    label: "GitHub Get Repo",
    description: "Get details for a specific GitHub repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; account?: string }) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const repo = await ghManager.get(account, `repos/${params.owner}/${params.repo}`);
        return jsonResult(repo);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubSearchCodeTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_search_code",
    label: "GitHub Search Code",
    description: "Search for code across GitHub repositories.",
    parameters: Type.Object({
      query: Type.String({
        description:
          "Search query. Supports GitHub search qualifiers (e.g. 'repo:owner/name language:ts').",
      }),
      per_page: Type.Optional(
        Type.String({
          description: "Results per page (max 100). Defaults to '30'.",
          default: "30",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; per_page?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = { q: params.query };
        if (params.per_page) qp.per_page = params.per_page;
        const results = await ghManager.get(account, "search/code", qp);
        return jsonResult(results);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubGetFileTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_get_file",
    label: "GitHub Get File",
    description:
      "Read the contents of a file from a GitHub repository. Returns the decoded file content.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      path: Type.String({ description: "File path within the repository." }),
      ref: Type.Optional(
        Type.String({
          description: "Branch, tag, or commit SHA. Defaults to the repo's default branch.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
      save_dir: Type.Optional(
        Type.String({
          description:
            "When provided, save the file to this directory instead of returning text content. Useful for binary files (images, PDFs, etc.).",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
        account?: string;
        save_dir?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.ref) qp.ref = params.ref;
        const data = (await ghManager.get(
          account,
          `repos/${params.owner}/${params.repo}/contents/${params.path}`,
          qp,
        )) as {
          content?: string;
          encoding?: string;
          name?: string;
          path?: string;
          size?: number;
          sha?: string;
        };

        // Decode base64 content
        if (data.content && data.encoding === "base64") {
          const rawBytes = Buffer.from(data.content.replace(/\n/g, ""), "base64");

          if (params.save_dir) {
            // Binary download mode
            ensureDir(params.save_dir);
            const filename = sanitizeFilename(data.name ?? "github-file");
            const filepath = join(params.save_dir, filename);
            writeFileSync(filepath, rawBytes);
            return jsonResult({
              name: data.name,
              path: filepath,
              size: rawBytes.length,
              sha: data.sha,
              mode: "downloaded",
            });
          }

          // Text mode (existing behavior)
          const decoded = rawBytes.toString("utf-8");
          return jsonResult({
            name: data.name,
            path: data.path,
            size: data.size,
            sha: data.sha,
            content: decoded,
          });
        }
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubBranchesTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_branches",
    label: "GitHub Branches",
    description: "List branches for a GitHub repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      per_page: Type.Optional(
        Type.String({
          description: "Results per page (max 100). Defaults to '30'.",
          default: "30",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; per_page?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.per_page) qp.per_page = params.per_page;
        const branches = await ghManager.get(
          account,
          `repos/${params.owner}/${params.repo}/branches`,
          qp,
        );
        return jsonResult(branches);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
