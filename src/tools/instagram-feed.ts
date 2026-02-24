import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { bestImageUrl, formatTimestamp, mediaTypeLabel, truncateText, formatUser } from "./instagram-utils.js";

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
export function createInstagramFeedTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_feed",
    label: "Instagram Feed",
    description: "Get posts from the user's Instagram home feed (timeline). Returns recent posts with author info, captions, and engagement metrics.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of posts to retrieve (default 10, max 50).",
          default: 10,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Instagram account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { count?: number; account?: string }) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const data = (await instagramManager.post(account, "feed/timeline/", {
          reason: "cold_start_fetch",
          is_pull_to_refresh: "0",
        })) as {
          feed_items?: Array<Record<string, unknown>>;
          items?: Array<Record<string, unknown>>;
        };

        const items = data?.feed_items ?? data?.items ?? [];
        const count = Math.min(params.count ?? 10, 50);

        const posts = items.slice(0, count).map((item) => {
          const media = (item.media_or_ad ?? item) as Record<string, unknown>;
          const user = media.user as Record<string, unknown> | undefined;
          const caption = media.caption as Record<string, unknown> | undefined;

          return {
            id: media.id ?? media.pk,
            code: media.code,
            media_type: mediaTypeLabel(media.media_type as number | undefined),
            caption: truncateText(caption?.text as string | undefined),
            image_url: bestImageUrl(media.image_versions2 as Record<string, unknown> | undefined),
            like_count: media.like_count,
            comment_count: media.comment_count,
            taken_at: formatTimestamp(media.taken_at as number | undefined),
            user: formatUser(user),
          };
        });

        return jsonResult({ count: posts.length, posts });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
