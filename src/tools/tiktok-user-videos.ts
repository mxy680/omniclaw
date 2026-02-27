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
export function createTikTokUserVideosTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_user_videos",
    label: "TikTok User Videos",
    description:
      "Get recent videos from a specific TikTok user by username. Returns their latest posts with descriptions and engagement metrics.",
    parameters: Type.Object({
      username: Type.String({
        description: "TikTok username without @ (e.g. 'charlidamelio').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of videos to retrieve (default 12, max 30).",
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
      params: { username: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const username = params.username.replace(/^@/, "");
        const count = Math.min(params.count ?? 12, 30);

        // First resolve username to secUid
        const userDetail = (await tiktokManager.get(
          account,
          `https://www.tiktok.com/api/user/detail/?uniqueId=${encodeURIComponent(username)}`,
        )) as { userInfo?: { user?: { secUid?: string } } };

        const secUid = userDetail?.userInfo?.user?.secUid;
        if (!secUid) {
          return jsonResult({ error: `Could not resolve user "${username}".` });
        }

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/post/item_list/",
          { secUid, count: String(count), cursor: "0" },
        )) as { itemList?: Array<Record<string, unknown>> };

        const items = data?.itemList ?? [];
        const videos = items.slice(0, count).map(formatVideo);

        return jsonResult({ username, count: videos.length, videos });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
