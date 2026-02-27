import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS, extractUser } from "./x-utils.js";

export function createXGetProfileTool(manager: XClientManager) {
  return {
    name: "x_get_profile",
    label: "X Get Profile",
    description: "Get a user's profile on X (Twitter) by their @handle.",
    parameters: Type.Object({
      screen_name: Type.String({ description: "The user's @handle (without the @)." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { screen_name: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const data = (await manager.graphqlGet(
          account,
          "UserByScreenName",
          QUERY_IDS.UserByScreenName,
          { screen_name: params.screen_name, withSafetyModeUserFields: true },
        )) as Record<string, unknown>;

        const user = extractUser(data);
        if (!user) return jsonResult({ error: `User @${params.screen_name} not found.` });
        return jsonResult(user);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXFollowTool(manager: XClientManager) {
  return {
    name: "x_follow",
    label: "X Follow",
    description: "Follow a user on X (Twitter). Requires the user's numeric ID (get it via x_get_profile first).",
    parameters: Type.Object({
      user_id: Type.String({ description: "The numeric user ID to follow." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { user_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const session = manager.getCredentials(account)!;
        const body = new URLSearchParams({ user_id: params.user_id });
        const resp = await fetch("https://api.x.com/1.1/friendships/create.json", {
          method: "POST",
          headers: {
            Authorization:
              "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
            "x-csrf-token": session.ct0,
            Cookie: `auth_token=${session.auth_token}; ct0=${session.ct0}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Follow failed: ${resp.status} — ${text.slice(0, 300)}`);
        }

        const data = (await resp.json()) as { screen_name?: string };
        return jsonResult({ status: "followed", user_id: params.user_id, screen_name: data.screen_name });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXUnfollowTool(manager: XClientManager) {
  return {
    name: "x_unfollow",
    label: "X Unfollow",
    description: "Unfollow a user on X (Twitter). Requires the user's numeric ID.",
    parameters: Type.Object({
      user_id: Type.String({ description: "The numeric user ID to unfollow." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { user_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const session = manager.getCredentials(account)!;
        const body = new URLSearchParams({ user_id: params.user_id });
        const resp = await fetch("https://api.x.com/1.1/friendships/destroy.json", {
          method: "POST",
          headers: {
            Authorization:
              "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
            "x-csrf-token": session.ct0,
            Cookie: `auth_token=${session.auth_token}; ct0=${session.ct0}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Unfollow failed: ${resp.status} — ${text.slice(0, 300)}`);
        }

        const data = (await resp.json()) as { screen_name?: string };
        return jsonResult({ status: "unfollowed", user_id: params.user_id, screen_name: data.screen_name });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
