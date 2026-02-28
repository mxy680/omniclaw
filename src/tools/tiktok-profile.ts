import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatUser } from "./tiktok-utils.js";

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
export function createTikTokProfileTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_profile",
    label: "TikTok Profile",
    description:
      "Get the authenticated user's TikTok profile including username, nickname, bio, follower/following counts, and avatar.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const data = await tiktokManager.getUserDetail(account, "me");

        const user = data?.userInfo?.user;
        const stats = data?.userInfo?.stats;
        if (!user) {
          return jsonResult({ error: "No profile data found in response." });
        }

        return jsonResult({
          uniqueId: user.uniqueId,
          nickname: user.nickname,
          bio: user.signature,
          avatarUrl: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb,
          verified: user.verified,
          followerCount: stats?.followerCount,
          followingCount: stats?.followingCount,
          heartCount: stats?.heartCount,
          videoCount: stats?.videoCount,
          id: user.id,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokGetUserTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_get_user",
    label: "TikTok Get User",
    description:
      "Get any TikTok user's public profile by username. Returns bio, follower/following counts, video count, and total likes.",
    parameters: Type.Object({
      username: Type.String({
        description: "TikTok username without @ (e.g. 'charlidamelio').",
      }),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { username: string; account?: string }) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const username = params.username.replace(/^@/, "");
        const data = await tiktokManager.getUserDetail(account, username);

        const user = data?.userInfo?.user;
        const stats = data?.userInfo?.stats;
        if (!user) {
          return jsonResult({ error: `User "${params.username}" not found.` });
        }

        return jsonResult({
          uniqueId: user.uniqueId,
          nickname: user.nickname,
          bio: user.signature,
          avatarUrl: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb,
          verified: user.verified,
          privateAccount: user.privateAccount,
          followerCount: stats?.followerCount,
          followingCount: stats?.followingCount,
          heartCount: stats?.heartCount,
          videoCount: stats?.videoCount,
          id: user.id,
          secUid: user.secUid,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
