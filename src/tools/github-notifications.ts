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
export function createGitHubNotificationsTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_notifications",
    label: "GitHub Notifications",
    description: "List your GitHub notifications.",
    parameters: Type.Object({
      all: Type.Optional(
        Type.String({
          description:
            "If 'true', show all notifications including read ones. Defaults to 'false'.",
          default: "false",
        }),
      ),
      participating: Type.Optional(
        Type.String({
          description:
            "If 'true', only show notifications you're directly participating in. Defaults to 'false'.",
          default: "false",
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
      params: { all?: string; participating?: string; per_page?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.all) qp.all = params.all;
        if (params.participating) qp.participating = params.participating;
        if (params.per_page) qp.per_page = params.per_page;
        const notifications = await ghManager.get(account, "notifications", qp);
        return jsonResult(notifications);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubMarkNotificationReadTool(ghManager: GitHubClientManager): any {
  return {
    name: "github_mark_notification_read",
    label: "GitHub Mark Notification Read",
    description: "Mark a notification thread as read.",
    parameters: Type.Object({
      thread_id: Type.String({ description: "The notification thread ID." }),
      account: Type.Optional(
        Type.String({
          description: "GitHub account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { thread_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!ghManager.hasToken(account)) return jsonResult(GITHUB_AUTH_REQUIRED);
      try {
        await ghManager.patch(account, `notifications/threads/${params.thread_id}`);
        return jsonResult({
          status: "ok",
          thread_id: params.thread_id,
          message: "Notification marked as read.",
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
