import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubCommitListTool(manager: GitHubClientManager): any {
  return {
    name: "github_commit_list",
    label: "GitHub List Commits",
    description: "List commits for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      sha: Type.Optional(Type.String({ description: "Branch name, tag, or commit SHA." })),
      path: Type.Optional(Type.String({ description: "Only commits containing this file path." })),
      author: Type.Optional(Type.String({ description: "GitHub login or email to filter by." })),
      since: Type.Optional(Type.String({ description: "Only commits after this date (ISO 8601)." })),
      until: Type.Optional(Type.String({ description: "Only commits before this date (ISO 8601)." })),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string; repo: string; sha?: string; path?: string; author?: string;
        since?: string; until?: string; per_page?: number; page?: number; account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.listCommits({
          owner: params.owner, repo: params.repo, sha: params.sha, path: params.path,
          author: params.author, since: params.since, until: params.until,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((c) => ({
            sha: c.sha,
            message: c.commit.message.substring(0, 200),
            author: c.commit.author?.name,
            date: c.commit.author?.date,
            html_url: c.html_url,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubCommitGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_commit_get",
    label: "GitHub Get Commit",
    description: "Get detailed information about a commit.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      ref: Type.String({ description: "Commit SHA." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; ref: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.getCommit({
          owner: params.owner, repo: params.repo, ref: params.ref,
        });
        return jsonResult({
          sha: data.sha,
          message: data.commit.message,
          author: data.commit.author,
          committer: data.commit.committer,
          stats: data.stats,
          files: (data.files ?? []).map((f) => ({
            filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions,
          })),
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubCompareTool(manager: GitHubClientManager): any {
  return {
    name: "github_compare",
    label: "GitHub Compare",
    description: "Compare two commits, branches, or tags.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      base: Type.String({ description: "Base branch, tag, or SHA." }),
      head: Type.String({ description: "Head branch, tag, or SHA." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; base: string; head: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.compareCommits({
          owner: params.owner, repo: params.repo, base: params.base, head: params.head,
        });
        return jsonResult({
          status: data.status,
          ahead_by: data.ahead_by,
          behind_by: data.behind_by,
          total_commits: data.total_commits,
          commits: data.commits.map((c) => ({ sha: c.sha, message: c.commit.message.substring(0, 200) })),
          files: (data.files ?? []).map((f) => ({
            filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions,
          })),
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRefListTool(manager: GitHubClientManager): any {
  return {
    name: "github_ref_list",
    label: "GitHub List Refs",
    description: "List git references matching a pattern (e.g. 'heads', 'tags').",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      ref: Type.String({ description: "Ref pattern, e.g. 'heads', 'tags', 'heads/main'." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; ref: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.git.listMatchingRefs({
          owner: params.owner, repo: params.repo, ref: params.ref,
        });
        return jsonResult(data.map((r) => ({ ref: r.ref, sha: r.object.sha })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubTreeGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_tree_get",
    label: "GitHub Get Tree",
    description: "Get a git tree (directory listing) by tree SHA.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      tree_sha: Type.String({ description: "Tree SHA." }),
      recursive: Type.Optional(Type.Boolean({ description: "Recursively list all files.", default: false })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; tree_sha: string; recursive?: boolean; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.git.getTree({
          owner: params.owner, repo: params.repo, tree_sha: params.tree_sha,
          recursive: params.recursive ? "1" : undefined,
        });
        return jsonResult({
          sha: data.sha,
          truncated: data.truncated,
          tree: data.tree.map((t) => ({
            path: t.path, mode: t.mode, type: t.type, size: t.size, sha: t.sha,
          })),
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
