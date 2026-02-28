import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { parseTikTokVideoId } from "./tiktok-utils.js";

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
export function createTikTokVideoCommentsTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_video_comments",
    label: "TikTok Video Comments",
    description: "Get comments on a specific TikTok video by URL or video ID.",
    parameters: Type.Object({
      video: Type.String({
        description:
          "TikTok video URL or video ID (e.g. 'https://www.tiktok.com/@user/video/7123456789' or '7123456789').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of comments to retrieve (default 20, max 50).",
          default: 20,
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
      params: { video: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const videoInput = params.video.includes("tiktok.com")
          ? params.video
          : parseTikTokVideoId(params.video);
        const count = Math.min(params.count ?? 20, 50);

        const data = await tiktokManager.getVideoComments(account, videoInput);
        const comments = (data?.comments ?? []).slice(0, count).map((c) => ({
          text: c.text,
          diggCount: c.digg_count ?? c.diggCount,
          user: c.user as Record<string, unknown> | undefined,
        }));

        return jsonResult({
          videoId: videoInput,
          count: comments.length,
          comments,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
