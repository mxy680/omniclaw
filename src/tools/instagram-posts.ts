import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { bestImageUrl, formatTimestamp, mediaTypeLabel, truncateText, formatUser, parseShortcode, shortcodeToMediaId } from "./instagram-utils.js";

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
export function createInstagramUserPostsTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_user_posts",
    label: "Instagram User Posts",
    description: "Get recent posts from a specific Instagram user by username. Returns their latest media with captions and engagement.",
    parameters: Type.Object({
      username: Type.String({
        description: "Instagram username (e.g. 'natgeo').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of posts to retrieve (default 12, max 50).",
          default: 12,
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
        const count = Math.min(params.count ?? 12, 50);

        const data = (await instagramManager.get(account, `feed/user/${pk}/`, {
          count: String(count),
        })) as {
          items?: Array<Record<string, unknown>>;
        };

        const items = data?.items ?? [];
        const posts = items.slice(0, count).map((media) => {
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

        return jsonResult({ username: params.username, count: posts.length, posts });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramPostDetailsTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_post_details",
    label: "Instagram Post Details",
    description: "Get detailed info about a specific Instagram post by shortcode or URL. Returns full caption, engagement metrics, and media info.",
    parameters: Type.Object({
      shortcode: Type.String({
        description: "Post shortcode or full Instagram URL (e.g. 'CxYz123' or 'https://www.instagram.com/p/CxYz123/').",
      }),
      account: Type.Optional(
        Type.String({
          description: "Instagram account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { shortcode: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const shortcode = parseShortcode(params.shortcode);
        const mediaId = shortcodeToMediaId(shortcode);

        const data = (await instagramManager.get(account, `media/${mediaId}/info/`)) as {
          items?: Array<Record<string, unknown>>;
        };

        const items = data?.items ?? [];
        if (items.length === 0) {
          return jsonResult({ error: "Post not found." });
        }

        const media = items[0];
        const user = media.user as Record<string, unknown> | undefined;
        const caption = media.caption as Record<string, unknown> | undefined;

        return jsonResult({
          id: media.id ?? media.pk,
          code: media.code ?? shortcode,
          media_type: mediaTypeLabel(media.media_type as number | undefined),
          caption: caption?.text ?? null,
          image_url: bestImageUrl(media.image_versions2 as Record<string, unknown> | undefined),
          like_count: media.like_count,
          comment_count: media.comment_count,
          view_count: media.view_count ?? media.play_count,
          taken_at: formatTimestamp(media.taken_at as number | undefined),
          location: media.location
            ? { name: (media.location as Record<string, unknown>).name }
            : null,
          user: formatUser(user),
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
