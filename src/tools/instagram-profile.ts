import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("instagram");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramProfileGetTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_profile_get",
    label: "Instagram Profile Get",
    description: "Get the authenticated user's Instagram profile information.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.request<Record<string, unknown>>({
          path: "/accounts/current_user/info/",
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
export function createInstagramProfileViewTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_profile_view",
    label: "Instagram Profile View",
    description: "View another user's Instagram profile by username.",
    parameters: Type.Object({
      username: Type.String({
        description: "The Instagram username to look up.",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { username: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.request<Record<string, unknown>>({
          path: `/users/web_profile_info/?username=${encodeURIComponent(params.username)}`,
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
