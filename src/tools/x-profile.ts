import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

// GraphQL query IDs — these are X's internal operation identifiers
const USER_BY_SCREEN_NAME_QUERY_ID = "xmU6X_CKVnQ5lSrCbAmJsg";
const USER_BY_SCREEN_NAME_OP = "UserByScreenName";

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
        const settings = await client.v1<Record<string, unknown>>({
          path: "/account/settings.json",
        });
        const screenName = settings?.screen_name as string | undefined;
        if (!screenName) {
          return jsonResult({ error: "could_not_get_screen_name" });
        }
        // Now fetch full profile via GraphQL
        const result = await client.graphql({
          queryId: USER_BY_SCREEN_NAME_QUERY_ID,
          operationName: USER_BY_SCREEN_NAME_OP,
          variables: {
            screen_name: screenName,
            withSafetyModeUserFields: true,
          },
          method: "GET",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = (result as any)?.data?.user?.result;
        const legacy = user?.legacy ?? {};
        return jsonResult({
          id: user?.rest_id,
          username: legacy.screen_name,
          name: legacy.name,
          bio: legacy.description,
          followers_count: legacy.followers_count,
          following_count: legacy.friends_count,
          tweet_count: legacy.statuses_count,
          verified: user?.is_blue_verified,
          profile_image_url: legacy.profile_image_url_https,
          created_at: legacy.created_at,
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
