import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("instagram");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramSearchTool(manager: InstagramClientManager): any {
  return {
    name: "instagram_search",
    label: "Instagram Search",
    description: "Search Instagram for users, hashtags, and places.",
    parameters: Type.Object({
      query: Type.String({
        description: "The search query.",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.request<Record<string, unknown>>({
          path: `/web/search/topsearch/?query=${encodeURIComponent(params.query)}`,
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
