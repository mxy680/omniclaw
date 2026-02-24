import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { bestImageUrl, formatTimestamp, truncateText, formatUser } from "./instagram-utils.js";

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
export function createInstagramReelsTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_reels",
    label: "Instagram Reels",
    description: "Get trending/popular Instagram Reels. Returns a list of short-form video posts with engagement metrics.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of reels to retrieve (default 10, max 30).",
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
    async execute(
      _toolCallId: string,
      params: { count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const data = (await instagramManager.get(account, "discover/topical_explore/", {
          is_prefetch: "false",
          omit_cover_media: "false",
          use_sectional_payload: "true",
          cluster_id: "explore_all:0",
        })) as {
          items?: Array<Record<string, unknown>>;
          sectional_items?: Array<Record<string, unknown>>;
        };

        // Items may be nested under sectional_items -> layout_content -> medias
        const rawItems: Array<Record<string, unknown>> = [];
        if (data?.sectional_items) {
          for (const section of data.sectional_items) {
            const layoutContent = section.layout_content as Record<string, unknown> | undefined;
            const medias = (
              layoutContent?.medias ??
              (layoutContent?.one_by_two_item as Record<string, unknown> | undefined)?.clips as Record<string, unknown> | undefined
            ) as Array<Record<string, unknown>> | undefined;
            if (medias) {
              for (const m of medias) {
                const media = ((m as Record<string, unknown>).media ?? m) as Record<string, unknown>;
                if (media.media_type === 2) rawItems.push(media); // Video/Reels only
              }
            }
          }
        }
        const items = rawItems.length > 0 ? rawItems : (data?.items ?? []);

        const count = Math.min(params.count ?? 10, 30);

        const reels = items.slice(0, count).map((item) => {
          const media = (item.media ?? item) as Record<string, unknown>;
          const user = media.user as Record<string, unknown> | undefined;
          const caption = media.caption as Record<string, unknown> | undefined;

          return {
            id: media.id ?? media.pk,
            code: media.code,
            caption: truncateText(caption?.text as string | undefined),
            image_url: bestImageUrl(media.image_versions2 as Record<string, unknown> | undefined),
            like_count: media.like_count,
            comment_count: media.comment_count,
            play_count: media.play_count ?? media.view_count,
            taken_at: formatTimestamp(media.taken_at as number | undefined),
            user: formatUser(user),
          };
        });

        return jsonResult({ count: reels.length, reels });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
