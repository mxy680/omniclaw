import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("instagram");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramPostLikeTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_post_like",
    label: "Instagram Post Like",
    description: "Like a post on Instagram.",
    parameters: Type.Object({
      media_id: Type.String({
        description: "The numeric media ID of the post to like.",
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
          method: "POST",
          path: `/web/likes/${encodeURIComponent(params.media_id)}/like/`,
        });
        return jsonResult({ status: "liked", media_id: params.media_id, ...result });
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
export function createInstagramPostUnlikeTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_post_unlike",
    label: "Instagram Post Unlike",
    description: "Unlike a post on Instagram.",
    parameters: Type.Object({
      media_id: Type.String({
        description: "The numeric media ID of the post to unlike.",
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
          method: "POST",
          path: `/web/likes/${encodeURIComponent(params.media_id)}/unlike/`,
        });
        return jsonResult({ status: "unliked", media_id: params.media_id, ...result });
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
export function createInstagramPostCommentTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_post_comment",
    label: "Instagram Post Comment",
    description: "Add a comment to an Instagram post.",
    parameters: Type.Object({
      media_id: Type.String({
        description: "The numeric media ID of the post to comment on.",
      }),
      text: Type.String({ description: "The comment text." }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { media_id: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.request<Record<string, unknown>>({
          method: "POST",
          path: `/web/comments/${encodeURIComponent(params.media_id)}/add/`,
          body: { comment_text: params.text },
        });
        return jsonResult({ status: "commented", media_id: params.media_id, ...result });
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
