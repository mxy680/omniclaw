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
export function createGitHubIssuesTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_issues",
    label: "GitHub Issues",
    description:
      "List issues for a GitHub repository. Returns issue number, title, state, labels, and assignees.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.String({
          description: "Filter by state: 'open', 'closed', 'all'. Defaults to 'open'.",
          default: "open",
        }),
      ),
      labels: Type.Optional(
        Type.String({ description: "Comma-separated list of label names to filter by." }),
      ),
      assignee: Type.Optional(
        Type.String({
          description: "Filter by assignee username. Use '*' for any, 'none' for unassigned.",
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
      params: {
        owner: string;
        repo: string;
        state?: string;
        labels?: string;
        assignee?: string;
        per_page?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.state) qp.state = params.state;
        if (params.labels) qp.labels = params.labels;
        if (params.assignee) qp.assignee = params.assignee;
        if (params.per_page) qp.per_page = params.per_page;
        const issues = await ghManager.get(
          account,
          `repos/${params.owner}/${params.repo}/issues`,
          qp,
        );
        return jsonResult(issues);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubGetIssueTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_get_issue",
    label: "GitHub Get Issue",
    description: "Get details for a specific GitHub issue, including its comments.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      issue_number: Type.String({ description: "The issue number." }),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; issue_number: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const base = `repos/${params.owner}/${params.repo}/issues/${params.issue_number}`;
        const [issue, comments] = await Promise.all([
          ghManager.get(account, base),
          ghManager.get(account, `${base}/comments`),
        ]);
        return jsonResult({ issue, comments });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubCreateIssueTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_create_issue",
    label: "GitHub Create Issue",
    description: "Create a new issue in a GitHub repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      title: Type.String({ description: "Issue title." }),
      body: Type.Optional(Type.String({ description: "Issue body (Markdown)." })),
      labels: Type.Optional(Type.Array(Type.String(), { description: "Labels to apply." })),
      assignees: Type.Optional(Type.Array(Type.String(), { description: "Usernames to assign." })),
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
        body?: string;
        labels?: string[];
        assignees?: string[];
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const payload: Record<string, unknown> = { title: params.title };
        if (params.body !== undefined) payload.body = params.body;
        if (params.labels) payload.labels = params.labels;
        if (params.assignees) payload.assignees = params.assignees;
        const issue = await ghManager.post(
          account,
          `repos/${params.owner}/${params.repo}/issues`,
          payload,
        );
        return jsonResult(issue);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubUpdateIssueTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_update_issue",
    label: "GitHub Update Issue",
    description: "Update an existing GitHub issue (title, body, state, labels, assignees).",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      issue_number: Type.String({ description: "The issue number." }),
      title: Type.Optional(Type.String({ description: "New title." })),
      body: Type.Optional(Type.String({ description: "New body (Markdown)." })),
      state: Type.Optional(Type.String({ description: "New state: 'open' or 'closed'." })),
      labels: Type.Optional(Type.Array(Type.String(), { description: "Replace all labels." })),
      assignees: Type.Optional(
        Type.Array(Type.String(), { description: "Replace all assignees." }),
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
        issue_number: string;
        title?: string;
        body?: string;
        state?: string;
        labels?: string[];
        assignees?: string[];
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const payload: Record<string, unknown> = {};
        if (params.title !== undefined) payload.title = params.title;
        if (params.body !== undefined) payload.body = params.body;
        if (params.state !== undefined) payload.state = params.state;
        if (params.labels) payload.labels = params.labels;
        if (params.assignees) payload.assignees = params.assignees;
        const issue = await ghManager.patch(
          account,
          `repos/${params.owner}/${params.repo}/issues/${params.issue_number}`,
          payload,
        );
        return jsonResult(issue);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubAddIssueCommentTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_add_issue_comment",
    label: "GitHub Add Issue Comment",
    description: "Add a comment to a GitHub issue.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner (user or org)." }),
      repo: Type.String({ description: "Repository name." }),
      issue_number: Type.String({ description: "The issue number." }),
      body: Type.String({ description: "Comment body (Markdown)." }),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; issue_number: string; body: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const comment = await ghManager.post(
          account,
          `repos/${params.owner}/${params.repo}/issues/${params.issue_number}/comments`,
          { body: params.body },
        );
        return jsonResult(comment);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
