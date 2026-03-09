import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("instagram");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramInboxGetTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_inbox_get",
    label: "Instagram Inbox Get",
    description: "List the authenticated user's Instagram DM threads.",
    parameters: Type.Object({
      cursor: Type.Optional(
        Type.String({ description: "Pagination cursor from a previous response." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const qs = params.cursor ? `?cursor=${encodeURIComponent(params.cursor)}` : "";
        const result = await client.request<Record<string, unknown>>({
          path: `/direct_v2/inbox/${qs}`,
        });
        return jsonResult(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call instagram_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramMessagesGetTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_messages_get",
    label: "Instagram Messages Get",
    description: "Get messages in a specific Instagram DM thread.",
    parameters: Type.Object({
      thread_id: Type.String({
        description: "The DM thread ID.",
      }),
      cursor: Type.Optional(
        Type.String({ description: "Pagination cursor from a previous response." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { thread_id: string; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const qs = params.cursor ? `?cursor=${encodeURIComponent(params.cursor)}` : "";
        const result = await client.request<Record<string, unknown>>({
          path: `/direct_v2/threads/${encodeURIComponent(params.thread_id)}/${qs}`,
        });
        return jsonResult(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call instagram_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramMessageSendTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_message_send",
    label: "Instagram Message Send",
    description: "Send a text message in an Instagram DM thread.",
    parameters: Type.Object({
      thread_id: Type.String({
        description: "The DM thread ID to send to.",
      }),
      text: Type.String({ description: "The message text." }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { thread_id: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.request<Record<string, unknown>>({
          method: "POST",
          path: `/direct_v2/threads/broadcast/text/`,
          body: {
            thread_ids: `[${params.thread_id}]`,
            text: params.text,
          },
        });
        return jsonResult({ status: "sent", thread_id: params.thread_id, ...result });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call instagram_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
