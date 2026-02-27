import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";

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
export function createGitHubPullsTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_pulls",
    label: "GitHub Pull Requests",
    description: "List pull requests for a GitHub repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.String({
          description: "Filter by state: 'open', 'closed', 'all'. Defaults to 'open'.",
          default: "open",
        }),
      ),
      head: Type.Optional(
        Type.String({ description: "Filter by head branch (format: 'user:branch')." }),
      ),
      base: Type.Optional(Type.String({ description: "Filter by base branch name." })),
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
      params: {
        owner: string;
        repo: string;
        state?: string;
        head?: string;
        base?: string;
        per_page?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.state) qp.state = params.state;
        if (params.head) qp.head = params.head;
        if (params.base) qp.base = params.base;
        if (params.per_page) qp.per_page = params.per_page;
        const pulls = await ghManager.get(
          account,
          `repos/${params.owner}/${params.repo}/pulls`,
          qp,
        );
        return jsonResult(pulls);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubGetPullTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_get_pull",
    label: "GitHub Get Pull Request",
    description:
      "Get details for a specific pull request, including diff stats and review summary.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.String({ description: "The pull request number." }),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; pull_number: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const base = `repos/${params.owner}/${params.repo}/pulls/${params.pull_number}`;
        const [pull, reviews] = await Promise.all([
          ghManager.get(account, base),
          ghManager.get(account, `${base}/reviews`),
        ]);
        return jsonResult({ pull, reviews });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubCreatePullTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_create_pull",
    label: "GitHub Create Pull Request",
    description: "Create a new pull request. Only use after project_code_edit has pushed a branch.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      title: Type.String({ description: "PR title." }),
      head: Type.String({
        description: "The branch that contains the changes (e.g. 'feature-branch').",
      }),
      base: Type.String({ description: "The branch you want to merge into (e.g. 'main')." }),
      body: Type.Optional(Type.String({ description: "PR description (Markdown)." })),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        title: string;
        head: string;
        base: string;
        body?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const payload: Record<string, unknown> = {
          title: params.title,
          head: params.head,
          base: params.base,
        };
        if (params.body !== undefined) payload.body = params.body;
        const pull = await ghManager.post(
          account,
          `repos/${params.owner}/${params.repo}/pulls`,
          payload,
        );
        return jsonResult(pull);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubMergePullTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_merge_pull",
    label: "GitHub Merge Pull Request",
    description: "Merge a pull request.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.String({ description: "The pull request number." }),
      merge_method: Type.Optional(
        Type.String({
          description: "Merge method: 'merge', 'squash', or 'rebase'. Defaults to 'merge'.",
          default: "merge",
        }),
      ),
      commit_title: Type.Optional(Type.String({ description: "Custom merge commit title." })),
      commit_message: Type.Optional(Type.String({ description: "Custom merge commit message." })),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        pull_number: string;
        merge_method?: string;
        commit_title?: string;
        commit_message?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const payload: Record<string, unknown> = {};
        if (params.merge_method) payload.merge_method = params.merge_method;
        if (params.commit_title) payload.commit_title = params.commit_title;
        if (params.commit_message) payload.commit_message = params.commit_message;
        const result = await ghManager.put(
          account,
          `repos/${params.owner}/${params.repo}/pulls/${params.pull_number}/merge`,
          payload,
        );
        return jsonResult(result);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubAddPullReviewTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_add_pull_review",
    label: "GitHub Add Pull Review",
    description: "Create a review on a pull request (approve, comment, or request changes).",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      pull_number: Type.String({ description: "The pull request number." }),
      event: Type.String({
        description: "Review action: 'APPROVE', 'COMMENT', or 'REQUEST_CHANGES'.",
      }),
      body: Type.Optional(
        Type.String({ description: "Review body (required for COMMENT and REQUEST_CHANGES)." }),
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
      params: {
        owner: string;
        repo: string;
        pull_number: string;
        event: string;
        body?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const payload: Record<string, unknown> = { event: params.event };
        if (params.body !== undefined) payload.body = params.body;
        const review = await ghManager.post(
          account,
          `repos/${params.owner}/${params.repo}/pulls/${params.pull_number}/reviews`,
          payload,
        );
        return jsonResult(review);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
