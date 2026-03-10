import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("instagram");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramFeedGetTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_feed_get",
    label: "Instagram Feed Get",
    description: "Get the authenticated user's Instagram timeline feed.",
    parameters: Type.Object({
      max_id: Type.Optional(
        Type.String({ description: "Pagination cursor from a previous response." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { max_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const qs = params.max_id ? `?max_id=${encodeURIComponent(params.max_id)}` : "";
        const result = await client.request<Record<string, unknown>>({
          path: `/feed/timeline/${qs}`,
          method: "POST",
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
export function createInstagramPostListTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_post_list",
    label: "Instagram Post List",
    description: "List posts (media) for a given user ID.",
    parameters: Type.Object({
      user_id: Type.Optional(Type.String({
        description: "The numeric user ID. Defaults to the authenticated user.",
      })),
      count: Type.Optional(
        Type.Number({ description: "Number of posts to return.", default: 12 }),
      ),
      max_id: Type.Optional(
        Type.String({ description: "Pagination cursor from a previous response." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { user_id?: string; count?: number; max_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const userId = params.user_id ?? client.getUserId();
        if (!userId) return jsonResult({ error: "missing_user_id", message: "Provide user_id or re-authenticate." });
        const count = params.count ?? 12;
        const qs = new URLSearchParams({ count: String(count) });
        if (params.max_id) qs.set("max_id", params.max_id);
        const result = await client.request<Record<string, unknown>>({
          path: `/feed/user/${encodeURIComponent(userId)}/?${qs.toString()}`,
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
export function createInstagramPostGetTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_post_get",
    label: "Instagram Post Get",
    description: "Get details of a specific Instagram post by media ID.",
    parameters: Type.Object({
      media_id: Type.String({
        description: "The numeric media ID of the post.",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { media_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.request<Record<string, unknown>>({
          path: `/media/${encodeURIComponent(params.media_id)}/info/`,
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
