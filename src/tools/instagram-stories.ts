import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { bestImageUrl, formatTimestamp, mediaTypeLabel, formatUser } from "./instagram-utils.js";

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
export function createInstagramStoriesTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_stories",
    label: "Instagram Stories",
    description: "Get stories from your Instagram story feed, or from a specific user. Without a username, returns the story tray (list of users with active stories). With a username, returns that user's current stories.",
    parameters: Type.Object({
      username: Type.Optional(
        Type.String({
          description: "Username to get stories for. If omitted, returns the story tray (who has active stories).",
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
      params: { username?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        if (params.username) {
          // Get stories for a specific user
          const pk = await instagramManager.resolveUsername(account, params.username);
          const data = (await instagramManager.get(account, `feed/user/${pk}/story/`)) as {
            reel?: { items?: Array<Record<string, unknown>>; user?: Record<string, unknown> };
          };

          const items = data?.reel?.items ?? [];
          const stories = items.map((item) => ({
            id: item.id ?? item.pk,
            media_type: mediaTypeLabel(item.media_type as number | undefined),
            image_url: bestImageUrl(item.image_versions2 as Record<string, unknown> | undefined),
            video_url: (item.video_versions as Array<Record<string, unknown>> | undefined)?.[0]?.url ?? null,
            taken_at: formatTimestamp(item.taken_at as number | undefined),
            expiring_at: formatTimestamp(item.expiring_at as number | undefined),
          }));

          return jsonResult({
            username: params.username,
            count: stories.length,
            stories,
          });
        } else {
          // Get story tray
          const data = (await instagramManager.get(account, "feed/reels_tray/")) as {
            tray?: Array<Record<string, unknown>>;
          };

          const tray = data?.tray ?? [];
          const users = tray.map((reel) => {
            const user = reel.user as Record<string, unknown> | undefined;
            return {
              user: formatUser(user),
              has_besties_media: reel.has_besties_media,
              latest_reel_media: formatTimestamp(reel.latest_reel_media as number | undefined),
              media_count: reel.media_count,
            };
          });

          return jsonResult({ count: users.length, story_tray: users });
        }
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
