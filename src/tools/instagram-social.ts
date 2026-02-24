import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { formatUser } from "./instagram-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call instagram_auth_setup to authenticate with Instagram first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramFollowersTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_followers",
    label: "Instagram Followers",
    description: "Get followers of an Instagram user by username. May fail for private accounts.",
    parameters: Type.Object({
      username: Type.String({
        description: "Instagram username (e.g. 'natgeo').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of followers to retrieve (default 20, max 100).",
          default: 20,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Instagram account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { username: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const pk = await instagramManager.resolveUsername(account, params.username);
        const count = Math.min(params.count ?? 20, 100);

        const data = (await instagramManager.get(account, `friendships/${pk}/followers/`, {
          count: String(count),
        })) as {
          users?: Array<Record<string, unknown>>;
        };

        const users = (data?.users ?? []).map((u) => ({
          ...formatUser(u),
          is_private: u.is_private,
        }));

        return jsonResult({ username: params.username, count: users.length, followers: users });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("400")) {
          return jsonResult({ error: `Cannot get followers for "${params.username}" — the account may be private.` });
        }
        return jsonResult({ error: msg });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramFollowingTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_following",
    label: "Instagram Following",
    description: "Get accounts that an Instagram user is following, by username. May fail for private accounts.",
    parameters: Type.Object({
      username: Type.String({
        description: "Instagram username (e.g. 'natgeo').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of accounts to retrieve (default 20, max 100).",
          default: 20,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Instagram account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { username: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const pk = await instagramManager.resolveUsername(account, params.username);
        const count = Math.min(params.count ?? 20, 100);

        const data = (await instagramManager.get(account, `friendships/${pk}/following/`, {
          count: String(count),
        })) as {
          users?: Array<Record<string, unknown>>;
        };

        const users = (data?.users ?? []).map((u) => ({
          ...formatUser(u),
          is_private: u.is_private,
        }));

        return jsonResult({ username: params.username, count: users.length, following: users });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("400")) {
          return jsonResult({ error: `Cannot get following for "${params.username}" — the account may be private.` });
        }
        return jsonResult({ error: msg });
      }
    },
  };
}
