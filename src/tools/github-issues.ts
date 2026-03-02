import { Type } from "@sinclair/typebox";
import type { GitHubClient } from "../auth/github-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueListTool(gh: GitHubClient): any {
  return {
    name: "github_issue_list",
    label: "GitHub List Issues",
    description: "List issues for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")],
          { description: "Filter by state.", default: "open" },
        ),
      ),
      labels: Type.Optional(
        Type.String({ description: "Comma-separated list of label names." }),
      ),
      assignee: Type.Optional(Type.String({ description: "Filter by assignee login." })),
      sort: Type.Optional(
        Type.Union(
          [Type.Literal("created"), Type.Literal("updated"), Type.Literal("comments")],
          { description: "Sort field.", default: "created" },
        ),
      ),
      direction: Type.Optional(
        Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
          description: "Sort direction.",
          default: "desc",
        }),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        state?: string;
        labels?: string;
        assignee?: string;
        sort?: string;
        direction?: string;
        per_page?: number;
        page?: number;
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.listForRepo({
          owner: params.owner,
          repo: params.repo,
          state: (params.state as "open") ?? "open",
          labels: params.labels,
          assignee: params.assignee,
          sort: (params.sort as "created") ?? "created",
          direction: (params.direction as "desc") ?? "desc",
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
        });
        return jsonResult(
          data.map((i) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            user: i.user?.login,
            labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
            assignees: (i.assignees ?? []).map((a) => a.login),
            created_at: i.created_at,
            updated_at: i.updated_at,
            html_url: i.html_url,
            comments: i.comments,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueGetTool(gh: GitHubClient): any {
  return {
    name: "github_issue_get",
    label: "GitHub Get Issue",
    description: "Get detailed information about an issue.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      issue_number: Type.Number({ description: "Issue number." }),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; issue_number: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.get({
          owner: params.owner,
          repo: params.repo,
          issue_number: params.issue_number,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueCreateTool(gh: GitHubClient): any {
  return {
    name: "github_issue_create",
    label: "GitHub Create Issue",
    description: "Create a new issue in a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      title: Type.String({ description: "Issue title." }),
      body: Type.Optional(Type.String({ description: "Issue body (markdown)." })),
      labels: Type.Optional(Type.Array(Type.String(), { description: "Label names." })),
      assignees: Type.Optional(Type.Array(Type.String(), { description: "Assignee logins." })),
      milestone: Type.Optional(Type.Number({ description: "Milestone number." })),
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
        milestone?: number;
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.create({
          owner: params.owner,
          repo: params.repo,
          title: params.title,
          body: params.body,
          labels: params.labels,
          assignees: params.assignees,
          milestone: params.milestone,
        });
        return jsonResult({ number: data.number, title: data.title, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueUpdateTool(gh: GitHubClient): any {
  return {
    name: "github_issue_update",
    label: "GitHub Update Issue",
    description: "Update an existing issue.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      issue_number: Type.Number({ description: "Issue number." }),
      title: Type.Optional(Type.String({ description: "New title." })),
      body: Type.Optional(Type.String({ description: "New body." })),
      state: Type.Optional(
        Type.Union([Type.Literal("open"), Type.Literal("closed")], {
          description: "New state.",
        }),
      ),
      labels: Type.Optional(Type.Array(Type.String(), { description: "Replace labels." })),
      assignees: Type.Optional(Type.Array(Type.String(), { description: "Replace assignees." })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        issue_number: number;
        title?: string;
        body?: string;
        state?: string;
        labels?: string[];
        assignees?: string[];
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.update({
          owner: params.owner,
          repo: params.repo,
          issue_number: params.issue_number,
          title: params.title,
          body: params.body,
          state: params.state as "open" | "closed" | undefined,
          labels: params.labels,
          assignees: params.assignees,
        });
        return jsonResult({
          number: data.number,
          title: data.title,
          state: data.state,
          html_url: data.html_url,
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueCommentListTool(gh: GitHubClient): any {
  return {
    name: "github_issue_comment_list",
    label: "GitHub List Issue Comments",
    description: "List comments on an issue.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      issue_number: Type.Number({ description: "Issue number." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        issue_number: number;
        per_page?: number;
        page?: number;
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.listComments({
          owner: params.owner,
          repo: params.repo,
          issue_number: params.issue_number,
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
        });
        return jsonResult(
          data.map((c) => ({
            id: c.id,
            user: c.user?.login,
            body: c.body,
            created_at: c.created_at,
            updated_at: c.updated_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueCommentCreateTool(gh: GitHubClient): any {
  return {
    name: "github_issue_comment_create",
    label: "GitHub Create Issue Comment",
    description: "Add a comment to an issue.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      issue_number: Type.Number({ description: "Issue number." }),
      body: Type.String({ description: "Comment body (markdown)." }),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; issue_number: number; body: string },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.createComment({
          owner: params.owner,
          repo: params.repo,
          issue_number: params.issue_number,
          body: params.body,
        });
        return jsonResult({ id: data.id, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueCommentUpdateTool(gh: GitHubClient): any {
  return {
    name: "github_issue_comment_update",
    label: "GitHub Update Issue Comment",
    description: "Update an existing comment on an issue.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      comment_id: Type.Number({ description: "Comment ID." }),
      body: Type.String({ description: "New comment body." }),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; comment_id: number; body: string },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.updateComment({
          owner: params.owner,
          repo: params.repo,
          comment_id: params.comment_id,
          body: params.body,
        });
        return jsonResult({ id: data.id, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueCommentDeleteTool(gh: GitHubClient): any {
  return {
    name: "github_issue_comment_delete",
    label: "GitHub Delete Issue Comment",
    description: "Delete a comment from an issue.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      comment_id: Type.Number({ description: "Comment ID." }),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; comment_id: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.issues.deleteComment({
          owner: params.owner,
          repo: params.repo,
          comment_id: params.comment_id,
        });
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueLabelListTool(gh: GitHubClient): any {
  return {
    name: "github_issue_label_list",
    label: "GitHub List Labels",
    description: "List labels for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; per_page?: number; page?: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.listLabelsForRepo({
          owner: params.owner,
          repo: params.repo,
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
        });
        return jsonResult(
          data.map((l) => ({ name: l.name, color: l.color, description: l.description })),
        );
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueLabelCreateTool(gh: GitHubClient): any {
  return {
    name: "github_issue_label_create",
    label: "GitHub Create Label",
    description: "Create a label in a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      name: Type.String({ description: "Label name." }),
      color: Type.String({ description: "Hex color code without #." }),
      description: Type.Optional(Type.String({ description: "Label description." })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        name: string;
        color: string;
        description?: string;
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.createLabel({
          owner: params.owner,
          repo: params.repo,
          name: params.name,
          color: params.color,
          description: params.description,
        });
        return jsonResult({ name: data.name, color: data.color, description: data.description });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueMilestoneListTool(gh: GitHubClient): any {
  return {
    name: "github_issue_milestone_list",
    label: "GitHub List Milestones",
    description: "List milestones for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")],
          { description: "Filter by state.", default: "open" },
        ),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; state?: string },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.listMilestones({
          owner: params.owner,
          repo: params.repo,
          state: (params.state as "open") ?? "open",
        });
        return jsonResult(
          data.map((m) => ({
            number: m.number,
            title: m.title,
            state: m.state,
            description: m.description,
            open_issues: m.open_issues,
            closed_issues: m.closed_issues,
            due_on: m.due_on,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubIssueMilestoneCreateTool(gh: GitHubClient): any {
  return {
    name: "github_issue_milestone_create",
    label: "GitHub Create Milestone",
    description: "Create a milestone in a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      title: Type.String({ description: "Milestone title." }),
      description: Type.Optional(Type.String({ description: "Milestone description." })),
      due_on: Type.Optional(Type.String({ description: "Due date (ISO 8601 format)." })),
      state: Type.Optional(
        Type.Union([Type.Literal("open"), Type.Literal("closed")], {
          description: "State.",
          default: "open",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        title: string;
        description?: string;
        due_on?: string;
        state?: string;
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.issues.createMilestone({
          owner: params.owner,
          repo: params.repo,
          title: params.title,
          description: params.description,
          due_on: params.due_on,
          state: (params.state as "open") ?? "open",
        });
        return jsonResult({ number: data.number, title: data.title, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
