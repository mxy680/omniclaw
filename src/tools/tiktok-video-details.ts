import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatVideo, parseTikTokVideoId } from "./tiktok-utils.js";

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
export function createTikTokVideoDetailsTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_video_details",
    label: "TikTok Video Details",
    description:
      "Get full details for a specific TikTok video by URL or video ID. Returns description, engagement metrics, author info, and music.",
    parameters: Type.Object({
      video: Type.String({
        description:
          "TikTok video URL or video ID (e.g. 'https://www.tiktok.com/@user/video/7123456789' or '7123456789').",
      }),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { video: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const videoId = parseTikTokVideoId(params.video);

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/item/detail/",
          { itemId: videoId },
        )) as { itemInfo?: { itemStruct?: Record<string, unknown> } };

        const item = data?.itemInfo?.itemStruct;
        if (!item) {
          return jsonResult({ error: "Video not found." });
        }

        return jsonResult(formatVideo(item));
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
