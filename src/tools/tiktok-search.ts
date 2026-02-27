import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatVideo, formatUser } from "./tiktok-utils.js";

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
  action: "Call tiktok_auth_setup to authenticate with TikTok first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokSearchVideosTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_search_videos",
    label: "TikTok Search Videos",
    description: "Search TikTok for videos matching a keyword query.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (e.g. 'cooking recipes', 'dance trends').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of results (default 12, max 30).",
          default: 12,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 12, 30);

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/search/general/full/",
          { keyword: params.query, offset: "0", count: String(count) },
        )) as { data?: Array<Record<string, unknown>> };

        const rawItems = data?.data ?? [];
        const videos = rawItems
          .filter((item) => item.type === 1) // type 1 = video
          .map((item) => {
            const itemContent = item.item as Record<string, unknown> | undefined;
            return itemContent ? formatVideo(itemContent) : null;
          })
          .filter(Boolean)
          .slice(0, count);

        return jsonResult({ query: params.query, count: videos.length, videos });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokSearchUsersTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_search_users",
    label: "TikTok Search Users",
    description: "Search TikTok for user accounts matching a keyword query.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (e.g. 'gordon ramsay', 'dance').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of results (default 10, max 30).",
          default: 10,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 10, 30);

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/search/user/full/",
          { keyword: params.query, offset: "0", count: String(count) },
        )) as { user_list?: Array<Record<string, unknown>> };

        const rawUsers = data?.user_list ?? [];
        const users = rawUsers.slice(0, count).map((item) => {
          const userInfo = item.user_info as Record<string, unknown> | undefined;
          if (!userInfo) return null;
          return {
            ...formatUser(userInfo),
            signature: userInfo.signature,
            followerCount: userInfo.follower_count ?? (item as Record<string, unknown>).follower_count,
          };
        }).filter(Boolean);

        return jsonResult({ query: params.query, count: users.length, users });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
