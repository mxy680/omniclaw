import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

const FOLLOWERS_QUERY_ID = "rRXFSG5vR6drKr5BM3GzVw";
const FOLLOWERS_OP = "Followers";
const FOLLOWING_QUERY_ID = "iSicc7LrzWGBgDPL0tM_TQ";
const FOLLOWING_OP = "Following";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractUsers(result: any): unknown[] {
  const users: unknown[] = [];
  const instructions = result?.data?.user?.result?.timeline?.timeline?.instructions ?? [];
  for (const instruction of instructions) {
    if (instruction.type !== "TimelineAddEntries") continue;
    for (const entry of instruction.entries ?? []) {
      const userResult = entry?.content?.itemContent?.user_results?.result;
      if (!userResult) continue;
      const legacy = userResult.legacy ?? {};
      users.push({
        id: userResult.rest_id,
        username: legacy.screen_name,
        name: legacy.name,
        bio: legacy.description,
        followers_count: legacy.followers_count,
        following_count: legacy.friends_count,
        verified: userResult.is_blue_verified,
        profile_image_url: legacy.profile_image_url_https,
      });
    }
  }
  return users;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXFollowersListTool(manager: XClientManager): any {
  return {
    name: "x_followers_list",
    label: "X Followers List",
    description: "List a user's followers.",
    parameters: Type.Object({
      user_id: Type.String({ description: "The user's numeric ID." }),
      count: Type.Optional(Type.Number({ description: "Number of followers.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor." })),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { user_id: string; count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const variables: Record<string, unknown> = {
          userId: params.user_id,
          count: params.count ?? 20,
          includePromotedContent: false,
        };
        if (params.cursor) variables.cursor = params.cursor;

        const result = await client.graphql({
          queryId: FOLLOWERS_QUERY_ID,
          operationName: FOLLOWERS_OP,
          variables,
          method: "GET",
        });
        return jsonResult({ followers: extractUsers(result) });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXFollowingListTool(manager: XClientManager): any {
  return {
    name: "x_following_list",
    label: "X Following List",
    description: "List accounts a user is following.",
    parameters: Type.Object({
      user_id: Type.String({ description: "The user's numeric ID." }),
      count: Type.Optional(Type.Number({ description: "Number of results.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor." })),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { user_id: string; count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const variables: Record<string, unknown> = {
          userId: params.user_id,
          count: params.count ?? 20,
          includePromotedContent: false,
        };
        if (params.cursor) variables.cursor = params.cursor;

        const result = await client.graphql({
          queryId: FOLLOWING_QUERY_ID,
          operationName: FOLLOWING_OP,
          variables,
          method: "GET",
        });
        return jsonResult({ following: extractUsers(result) });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXFollowTool(manager: XClientManager): any {
  return {
    name: "x_follow",
    label: "X Follow",
    description: "Follow a user.",
    parameters: Type.Object({
      user_id: Type.String({ description: "The user's numeric ID to follow." }),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { user_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        await client.v1({
          method: "POST",
          path: "/friendships/create.json",
          params: { user_id: params.user_id },
        });
        return jsonResult({ followed: true, user_id: params.user_id });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXUnfollowTool(manager: XClientManager): any {
  return {
    name: "x_unfollow",
    label: "X Unfollow",
    description: "Unfollow a user.",
    parameters: Type.Object({
      user_id: Type.String({ description: "The user's numeric ID to unfollow." }),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { user_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        await client.v1({
          method: "POST",
          path: "/friendships/destroy.json",
          params: { user_id: params.user_id },
        });
        return jsonResult({ unfollowed: true, user_id: params.user_id });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
