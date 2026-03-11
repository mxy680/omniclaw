import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

// GraphQL query IDs — these are X's internal operation identifiers
const USER_BY_SCREEN_NAME_QUERY_ID = "pLsOiyHJ1eFwPJlNmLp4Bg";
const USER_BY_SCREEN_NAME_OP = "UserByScreenName";
const VIEWER_QUERY_ID = "zWQLM9HIVahRSUvzUH4lDw";
const VIEWER_OP = "Viewer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXProfileGetTool(manager: XClientManager): any {
  return {
    name: "x_profile_get",
    label: "X Profile Get",
    description:
      "Get an X (Twitter) user's profile by username. Returns bio, follower count, tweet count, and more.",
    parameters: Type.Object({
      username: Type.String({ description: "X username (without @)." }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { username: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.graphql({
          queryId: USER_BY_SCREEN_NAME_QUERY_ID,
          operationName: USER_BY_SCREEN_NAME_OP,
          variables: {
            screen_name: params.username,
            withSafetyModeUserFields: true,
          },
          method: "GET",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = (result as any)?.data?.user?.result;
        if (!user) {
          return jsonResult({ error: "user_not_found", username: params.username });
        }
        const legacy = user.legacy ?? {};
        return jsonResult({
          id: user.rest_id,
          username: legacy.screen_name,
          name: legacy.name,
          bio: legacy.description,
          followers_count: legacy.followers_count,
          following_count: legacy.friends_count,
          tweet_count: legacy.statuses_count,
          verified: user.is_blue_verified,
          profile_image_url: legacy.profile_image_url_https,
          profile_banner_url: legacy.profile_banner_url,
          created_at: legacy.created_at,
          location: legacy.location,
          website: legacy.entities?.url?.urls?.[0]?.expanded_url,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call x_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXProfileMeTool(manager: XClientManager): any {
  return {
    name: "x_profile_me",
    label: "X Profile Me",
    description: "Get the authenticated X (Twitter) user's own profile information.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        // Fetch authenticated user's profile via GraphQL Viewer query
        const result = await client.graphql({
          queryId: VIEWER_QUERY_ID,
          operationName: VIEWER_OP,
          variables: {
            withCommunitiesMemberships: true,
            withSubscribedTab: true,
            withCommunitiesCreation: true,
          },
          method: "GET",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = (result as any)?.data?.viewer?.user_results?.result;
        if (!user) {
          return jsonResult({ error: "could_not_get_profile" });
        }
        const core = user.core ?? {};
        const legacy = user.legacy ?? {};
        return jsonResult({
          id: user.rest_id,
          username: core.screen_name,
          name: core.name,
          bio: user.profile_bio?.description ?? legacy.description,
          followers_count: legacy.followers_count,
          following_count: legacy.friends_count,
          tweet_count: legacy.statuses_count,
          verified: user.is_blue_verified,
          profile_image_url: user.avatar?.image_url,
          created_at: core.created_at,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call x_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
