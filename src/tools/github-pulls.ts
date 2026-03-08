import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullListTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_list",
    label: "GitHub List Pull Requests",
    description: "List pull requests for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")],
          { description: "Filter by state.", default: "open" },
        ),
      ),
      head: Type.Optional(Type.String({ description: "Filter by head user/org and branch (user:ref-name or org:ref-name)." })),
      base: Type.Optional(Type.String({ description: "Filter by base branch name." })),
      sort: Type.Optional(
        Type.Union(
          [Type.Literal("created"), Type.Literal("updated"), Type.Literal("popularity"), Type.Literal("long-running")],
          { description: "Sort field.", default: "created" },
        ),
      ),
      direction: Type.Optional(
        Type.Union([Type.Literal("asc"), Type.Literal("desc")], { description: "Sort direction.", default: "desc" }),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string; repo: string; state?: string; head?: string; base?: string;
        sort?: string; direction?: string; per_page?: number; page?: number; account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.list({
          owner: params.owner,
          repo: params.repo,
          state: (params.state as "open") ?? "open",
          head: params.head,
          base: params.base,
          sort: (params.sort as "created") ?? "created",
          direction: (params.direction as "desc") ?? "desc",
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
        });
        return jsonResult(
          data.map((p) => ({
            number: p.number,
            title: p.title,
            state: p.state,
            user: p.user?.login,
            head: p.head.ref,
            base: p.base.ref,
            created_at: p.created_at,
            updated_at: p.updated_at,
            html_url: p.html_url,
            draft: p.draft,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_get",
    label: "GitHub Get Pull Request",
    description: "Get detailed information about a pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; pull_number: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.get({
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullCreateTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_create",
    label: "GitHub Create Pull Request",
    description: "Create a new pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      title: Type.String({ description: "PR title." }),
      body: Type.Optional(Type.String({ description: "PR body (markdown)." })),
      head: Type.String({ description: "Branch containing changes." }),
      base: Type.String({ description: "Target branch." }),
      draft: Type.Optional(Type.Boolean({ description: "Create as draft.", default: false })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; title: string; body?: string; head: string; base: string; draft?: boolean; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.create({
          owner: params.owner, repo: params.repo, title: params.title,
          body: params.body, head: params.head, base: params.base, draft: params.draft ?? false,
        });
        return jsonResult({ number: data.number, title: data.title, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullUpdateTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_update",
    label: "GitHub Update Pull Request",
    description: "Update an existing pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      title: Type.Optional(Type.String({ description: "New title." })),
      body: Type.Optional(Type.String({ description: "New body." })),
      state: Type.Optional(
        Type.Union([Type.Literal("open"), Type.Literal("closed")], { description: "New state." }),
      ),
      base: Type.Optional(Type.String({ description: "New base branch." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; pull_number: number; title?: string; body?: string; state?: string; base?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.update({
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
          title: params.title, body: params.body,
          state: params.state as "open" | "closed" | undefined, base: params.base,
        });
        return jsonResult({ number: data.number, title: data.title, state: data.state, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullMergeTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_merge",
    label: "GitHub Merge Pull Request",
    description: "Merge a pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      commit_title: Type.Optional(Type.String({ description: "Merge commit title." })),
      commit_message: Type.Optional(Type.String({ description: "Merge commit message." })),
      merge_method: Type.Optional(
        Type.Union(
          [Type.Literal("merge"), Type.Literal("squash"), Type.Literal("rebase")],
          { description: "Merge method.", default: "merge" },
        ),
      ),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; pull_number: number; commit_title?: string; commit_message?: string; merge_method?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.merge({
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
          commit_title: params.commit_title, commit_message: params.commit_message,
          merge_method: (params.merge_method as "merge") ?? "merge",
        });
        return jsonResult({ merged: data.merged, sha: data.sha, message: data.message });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullFilesTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_files",
    label: "GitHub PR Files",
    description: "List files changed in a pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; pull_number: number; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.listFiles({
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((f) => ({
            filename: f.filename, status: f.status,
            additions: f.additions, deletions: f.deletions, changes: f.changes,
            patch: f.patch?.substring(0, 500),
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullDiffTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_diff",
    label: "GitHub PR Diff",
    description: "Get the diff for a pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; pull_number: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
          mediaType: { format: "diff" },
        });
        return jsonResult({ diff: data as unknown as string });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullReviewListTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_review_list",
    label: "GitHub List PR Reviews",
    description: "List reviews on a pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; pull_number: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.listReviews({
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
        });
        return jsonResult(
          data.map((r) => ({
            id: r.id, user: r.user?.login, state: r.state,
            body: r.body, submitted_at: r.submitted_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullReviewCreateTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_review_create",
    label: "GitHub Create PR Review",
    description: "Submit a review on a pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      body: Type.Optional(Type.String({ description: "Review body." })),
      event: Type.Union(
        [Type.Literal("APPROVE"), Type.Literal("REQUEST_CHANGES"), Type.Literal("COMMENT")],
        { description: "Review action." },
      ),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; pull_number: number; body?: string; event: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.createReview({
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
          body: params.body, event: params.event as "APPROVE",
        });
        return jsonResult({ id: data.id, state: data.state, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullReviewCommentsTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_review_comments",
    label: "GitHub PR Review Comments",
    description: "List review comments on a pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; pull_number: number; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.listReviewComments({
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((c) => ({
            id: c.id, user: c.user?.login, body: c.body,
            path: c.path, line: c.line, created_at: c.created_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullRequestReviewersTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_request_reviewers",
    label: "GitHub Request PR Reviewers",
    description: "Request reviewers for a pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      reviewers: Type.Optional(Type.Array(Type.String(), { description: "User logins to request." })),
      team_reviewers: Type.Optional(Type.Array(Type.String(), { description: "Team slugs to request." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; pull_number: number; reviewers?: string[]; team_reviewers?: string[]; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.pulls.requestReviewers({
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
          reviewers: params.reviewers, team_reviewers: params.team_reviewers,
        });
        return jsonResult({
          requested_reviewers: (data.requested_reviewers ?? []).map((r) => r.login),
          requested_teams: (data.requested_teams ?? []).map((t) => t.slug),
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubPullChecksTool(manager: GitHubClientManager): any {
  return {
    name: "github_pull_checks",
    label: "GitHub PR Checks",
    description: "List check runs for a pull request's head commit.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.Number({ description: "Pull request number." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; pull_number: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const pr = await octokit.rest.pulls.get({
          owner: params.owner, repo: params.repo, pull_number: params.pull_number,
        });
        const { data } = await octokit.rest.checks.listForRef({
          owner: params.owner, repo: params.repo, ref: pr.data.head.sha,
        });
        return jsonResult(
          data.check_runs.map((c) => ({
            name: c.name, status: c.status, conclusion: c.conclusion,
            started_at: c.started_at, completed_at: c.completed_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
