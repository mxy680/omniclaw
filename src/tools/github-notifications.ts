import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubNotificationListTool(manager: GitHubClientManager): any {
  return {
    name: "github_notification_list",
    label: "GitHub List Notifications",
    description: "List notifications for the authenticated user.",
    parameters: Type.Object({
      all: Type.Optional(Type.Boolean({ description: "Include read notifications.", default: false })),
      participating: Type.Optional(Type.Boolean({ description: "Only participating notifications.", default: false })),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { all?: boolean; participating?: boolean; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.activity.listNotificationsForAuthenticatedUser({
          all: params.all ?? false, participating: params.participating ?? false,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((n) => ({
            id: n.id, reason: n.reason, unread: n.unread,
            subject: { title: n.subject.title, type: n.subject.type },
            repository: n.repository.full_name, updated_at: n.updated_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubNotificationMarkReadTool(manager: GitHubClientManager): any {
  return {
    name: "github_notification_mark_read",
    label: "GitHub Mark Notifications Read",
    description: "Mark all notifications as read.",
    parameters: Type.Object({
      last_read_at: Type.Optional(
        Type.String({ description: "Timestamp (ISO 8601). Notifications updated before this will be marked read." }),
      ),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { last_read_at?: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.activity.markNotificationsAsRead({
          last_read_at: params.last_read_at,
        });
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubNotificationThreadReadTool(manager: GitHubClientManager): any {
  return {
    name: "github_notification_thread_read",
    label: "GitHub Mark Thread Read",
    description: "Mark a specific notification thread as read.",
    parameters: Type.Object({
      thread_id: Type.Number({ description: "Notification thread ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { thread_id: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.activity.markThreadAsRead({ thread_id: params.thread_id });
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubNotificationThreadSubscribeTool(manager: GitHubClientManager): any {
  return {
    name: "github_notification_thread_subscribe",
    label: "GitHub Subscribe to Thread",
    description: "Subscribe or unsubscribe from a notification thread.",
    parameters: Type.Object({
      thread_id: Type.Number({ description: "Notification thread ID." }),
      ignored: Type.Optional(Type.Boolean({ description: "Set to true to mute/ignore the thread.", default: false })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { thread_id: number; ignored?: boolean; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.activity.setThreadSubscription({
          thread_id: params.thread_id, ignored: params.ignored ?? false,
        });
        return jsonResult({ subscribed: data.subscribed, ignored: data.ignored });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
