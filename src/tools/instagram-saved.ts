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
export function createInstagramSavedTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_saved",
    label: "Instagram Saved",
    description: "Get your saved/bookmarked Instagram posts.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of saved posts to retrieve (default 20, max 50).",
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
      params: { count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const data = (await instagramManager.get(account, "feed/saved/posts/")) as {
          items?: Array<Record<string, unknown>>;
        };

        const items = data?.items ?? [];
        const count = Math.min(params.count ?? 20, 50);

        const posts = items.slice(0, count).map((item) => {
          const media = (item.media ?? item) as Record<string, unknown>;
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

        return jsonResult({ count: posts.length, saved_posts: posts });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
