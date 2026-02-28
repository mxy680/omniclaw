import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatVideo } from "./tiktok-utils.js";

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
export function createTikTokTrendingTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_trending",
    label: "TikTok Trending",
    description:
      "Get trending/popular TikTok videos from the discover page. Returns currently viral content.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of videos to retrieve (default 10, max 30).",
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
      params: { count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 10, 30);
        // Uses the same feed endpoint — TikTok's For You page serves trending content
        const data = await tiktokManager.getFeed(account);
        const items = data?.itemList ?? [];
        const videos = items.slice(0, count).map(formatVideo);
        return jsonResult({ count: videos.length, videos });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
