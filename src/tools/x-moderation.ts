import { Type } from "@sinclair/typebox";
import { type XClientManager, X_BEARER_TOKEN } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./x-utils.js";

// ---------------------------------------------------------------------------
// REST helper
// ---------------------------------------------------------------------------

/**
 * Builds the headers required for X REST 1.1 API calls.
 *
 * Unlike the GraphQL requests (which use application/json), these endpoints
 * expect application/x-www-form-urlencoded bodies, so Content-Type differs
 * from the headers built inside XClientManager.buildHeaders().
 */
function restHeaders(session: {
  auth_token: string;
  ct0: string;
  cookie_details?: Record<string, string>;
}): Record<string, string> {
  const cookieParts = [`auth_token=${session.auth_token}`, `ct0=${session.ct0}`];
  if (session.cookie_details) {
    for (const [key, value] of Object.entries(session.cookie_details)) {
      if (key !== "auth_token" && key !== "ct0") cookieParts.push(`${key}=${value}`);
    }
  }
  return {
    Authorization: `Bearer ${X_BEARER_TOKEN}`,
    "x-csrf-token": session.ct0,
    Cookie: cookieParts.join("; "),
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
  };
}

// ---------------------------------------------------------------------------
// Internal factory helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mute or unmute tool that hits the REST 1.1 API with a user_id body.
 */
function createUserModerationRestTool(
  name: string,
  label: string,
  description: string,
  endpoint: string,
  statusVerb: string,
  manager: XClientManager,
) {
  return {
    name,
    label,
    description,
    parameters: Type.Object({
      user_id: Type.String({ description: "The numeric user ID to act on." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { user_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const session = manager.getCredentials(account)!;
        const body = new URLSearchParams({ user_id: params.user_id });
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: restHeaders(session),
          body: body.toString(),
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`${label} failed: ${resp.status} — ${text.slice(0, 300)}`);
        }

        return jsonResult({ status: statusVerb, user_id: params.user_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

/**
 * Creates a pin, unpin, hide, or unhide tool that goes through the GraphQL API.
 */
function createTweetModerationGraphqlTool(
  name: string,
  label: string,
  description: string,
  operationName: string,
  queryId: string,
  statusVerb: string,
  manager: XClientManager,
) {
  return {
    name,
    label,
    description,
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet to act on." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        await manager.graphqlPost(account, operationName, queryId, {
          tweet_id: params.tweet_id,
        });
        return jsonResult({ status: statusVerb, tweet_id: params.tweet_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Exported tool factories
// ---------------------------------------------------------------------------

export function createXMuteTool(manager: XClientManager) {
  return createUserModerationRestTool(
    "x_mute",
    "X Mute",
    "Mute a user on X (Twitter). Muted users' posts will no longer appear in your timeline.",
    "https://api.x.com/1.1/mutes/users/create.json",
    "muted",
    manager,
  );
}

export function createXUnmuteTool(manager: XClientManager) {
  return createUserModerationRestTool(
    "x_unmute",
    "X Unmute",
    "Unmute a previously muted user on X (Twitter).",
    "https://api.x.com/1.1/mutes/users/destroy.json",
    "unmuted",
    manager,
  );
}

export function createXBlockTool(manager: XClientManager) {
  return createUserModerationRestTool(
    "x_block",
    "X Block",
    "Block a user on X (Twitter). Blocked users cannot follow you or view your tweets.",
    "https://api.x.com/1.1/blocks/create.json",
    "blocked",
    manager,
  );
}

export function createXUnblockTool(manager: XClientManager) {
  return createUserModerationRestTool(
    "x_unblock",
    "X Unblock",
    "Unblock a previously blocked user on X (Twitter).",
    "https://api.x.com/1.1/blocks/destroy.json",
    "unblocked",
    manager,
  );
}

export function createXPinTweetTool(manager: XClientManager) {
  return createTweetModerationGraphqlTool(
    "x_pin_tweet",
    "X Pin Tweet",
    "Pin a tweet to the top of your X (Twitter) profile.",
    "PinTweet",
    "VIHsNu89pK-kW35JpHq7Xw",
    "pinned",
    manager,
  );
}

export function createXUnpinTweetTool(manager: XClientManager) {
  return createTweetModerationGraphqlTool(
    "x_unpin_tweet",
    "X Unpin Tweet",
    "Unpin the currently pinned tweet from your X (Twitter) profile.",
    "UnpinTweet",
    "BhKei844ypCyLYCg0nwigw",
    "unpinned",
    manager,
  );
}

export function createXHideReplyTool(manager: XClientManager) {
  return createTweetModerationGraphqlTool(
    "x_hide_reply",
    "X Hide Reply",
    "Hide a reply to one of your tweets on X (Twitter). The reply is still visible to others but collapsed.",
    "ModerateTweet",
    "pjFnHGVqCjTcZol0xcBJjw",
    "hidden",
    manager,
  );
}

export function createXUnhideReplyTool(manager: XClientManager) {
  return createTweetModerationGraphqlTool(
    "x_unhide_reply",
    "X Unhide Reply",
    "Unhide a previously hidden reply on X (Twitter).",
    "UnmoderateTweet",
    "pVSyu6PA57TLvIE4nN2tsA",
    "unhidden",
    manager,
  );
}
