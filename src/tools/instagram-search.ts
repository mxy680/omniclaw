import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { formatUser } from "./instagram-utils.js";

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
export function createInstagramSearchTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_search",
    label: "Instagram Search",
    description: "Search Instagram for users, hashtags, and places. Returns blended results matching the query.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (e.g. 'photography', 'coffee shops').",
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
      params: { query: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const data = (await instagramManager.get(
          account,
          `web/search/topsearch/?query=${encodeURIComponent(params.query)}&context=blended`,
        )) as {
          users?: Array<Record<string, unknown>>;
          hashtags?: Array<Record<string, unknown>>;
          places?: Array<Record<string, unknown>>;
        };

        const users = (data?.users ?? []).map((u) => {
          const user = (u.user ?? u) as Record<string, unknown>;
          return {
            ...formatUser(user),
            follower_count: user.follower_count,
            is_private: user.is_private,
          };
        });

        const hashtags = (data?.hashtags ?? []).map((h) => {
          const tag = (h.hashtag ?? h) as Record<string, unknown>;
          return {
            name: tag.name,
            media_count: tag.media_count,
          };
        });

        const places = (data?.places ?? []).map((p) => {
          const place = (p.place ?? p) as Record<string, unknown>;
          const location = (place.location ?? place) as Record<string, unknown>;
          return {
            name: location.name ?? place.title,
            address: location.address,
            city: location.city,
            lat: location.lat,
            lng: location.lng,
          };
        });

        return jsonResult({
          users: { count: users.length, items: users },
          hashtags: { count: hashtags.length, items: hashtags },
          places: { count: places.length, items: places },
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
