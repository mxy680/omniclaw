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
export function createInstagramProfileTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_profile",
    label: "Instagram Profile",
    description: "Get the authenticated user's Instagram profile including username, full name, bio, follower/following counts, and profile picture.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Instagram account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const session = instagramManager.getCredentials(account);
        const pk = session?.ds_user_id ?? "";
        if (!pk) {
          return jsonResult({ error: "No user ID in session. Call instagram_auth_setup first." });
        }
        const data = (await instagramManager.get(account, `users/${pk}/info/`)) as {
          user?: Record<string, unknown>;
        };
        const user = data?.user;
        if (!user) {
          return jsonResult({ error: "No profile data found in response." });
        }
        return jsonResult({
          username: user.username,
          full_name: user.full_name,
          biography: user.biography,
          profile_pic_url: user.profile_pic_url,
          follower_count: user.follower_count,
          following_count: user.following_count,
          media_count: user.media_count,
          is_private: user.is_private,
          is_verified: user.is_verified,
          pk: user.pk,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramGetProfileTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_get_profile",
    label: "Instagram Get Profile",
    description:
      "Get any Instagram user's public profile by username. Returns bio, follower/following counts, and recent post count.",
    parameters: Type.Object({
      username: Type.String({
        description: "Instagram username (e.g. 'natgeo').",
      }),
      account: Type.Optional(
        Type.String({
          description: "Instagram account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { username: string; account?: string }) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const data = (await instagramManager.get(
          account,
          `users/web_profile_info/?username=${encodeURIComponent(params.username)}`,
        )) as { data?: { user?: Record<string, unknown> } };

        const user = data?.data?.user;
        if (!user) {
          return jsonResult({ error: `User "${params.username}" not found.` });
        }

        return jsonResult({
          username: user.username,
          full_name: user.full_name,
          biography: user.biography,
          profile_pic_url: user.profile_pic_url_hd ?? user.profile_pic_url,
          follower_count: (user.edge_followed_by as Record<string, unknown>)?.count ?? user.follower_count,
          following_count: (user.edge_follow as Record<string, unknown>)?.count ?? user.following_count,
          media_count: (user.edge_owner_to_timeline_media as Record<string, unknown>)?.count ?? user.media_count,
          is_private: user.is_private,
          is_verified: user.is_verified,
          external_url: user.external_url,
          pk: user.pk,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
