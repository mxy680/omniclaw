import { randomUUID } from "crypto";
import { Type } from "@sinclair/typebox";
import { type XClientManager, X_BEARER_TOKEN } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./x-utils.js";

/**
 * Builds headers for DM REST API calls (https://x.com/i/api/1.1/dm/...).
 *
 * DM endpoints are REST, not GraphQL, but use the same dual-token auth
 * scheme: static public bearer token + per-session ct0 CSRF token.
 * Content-Type is application/json because DM mutations send a JSON body.
 */
function dmHeaders(session: {
  auth_token: string;
  ct0: string;
  cookie_details?: Record<string, string>;
}): Record<string, string> {
  const cookieParts: string[] = [
    `auth_token=${session.auth_token}`,
    `ct0=${session.ct0}`,
  ];

  if (session.cookie_details) {
    for (const [key, value] of Object.entries(session.cookie_details)) {
      // Avoid duplicating the primary cookies already added above.
      if (key !== "auth_token" && key !== "ct0") {
        cookieParts.push(`${key}=${value}`);
      }
    }
  }

  return {
    Authorization: `Bearer ${X_BEARER_TOKEN}`,
    "x-csrf-token": session.ct0,
    Cookie: cookieParts.join("; "),
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
  };
}

export function createXDmInboxTool(manager: XClientManager) {
  return {
    name: "x_dm_inbox",
    label: "X DM Inbox",
    description: "Get your DM inbox on X (Twitter). Returns recent conversations.",
    parameters: Type.Object({
      cursor: Type.Optional(
        Type.String({ description: "Pagination cursor returned by a previous call." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const session = manager.getCredentials(account)!;

      // Base query string covers all the inbox fields X's web client requests.
      let url =
        "https://x.com/i/api/1.1/dm/inbox_initial_state.json" +
        "?nsfw_filtering_enabled=false" +
        "&filter_low_quality=false" +
        "&include_quality=all" +
        "&include_profile_interstitial_type=1" +
        "&include_blocking=1" +
        "&include_blocked_by=1" +
        "&include_followed_by=1" +
        "&include_want_retweets=1" +
        "&include_mute_edge=1" +
        "&include_can_dm=1" +
        "&include_can_media_tag=1" +
        "&include_ext_is_blue_verified=1" +
        "&include_ext_verified_type=1" +
        "&skip_status=1" +
        "&dm_secret_conversations_enabled=false" +
        "&krs_registration_enabled=true" +
        "&cards_platform=Web-12" +
        "&include_cards=1" +
        "&include_ext_alt_text=true" +
        "&include_ext_limited_action_results=true" +
        "&include_quote_count=true" +
        "&include_reply_count=1" +
        "&tweet_mode=extended" +
        "&include_ext_views=true" +
        "&dm_users=true" +
        "&include_groups=true" +
        "&include_inbox_timelines=true" +
        "&include_ext_media_color=true" +
        "&supports_reactions=true" +
        "&ext=mediaColor,altText,mediaStats,highlightedLabel,voiceInfo,birdwatchPivot,superFollowMetadata,unmentionInfo,editControl";

      if (params.cursor) {
        url += `&cursor=${encodeURIComponent(params.cursor)}`;
      }

      try {
        const resp = await fetch(url, {
          method: "GET",
          headers: dmHeaders(session),
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(
            `X DM inbox HTTP error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await resp.json()) as any;
        return jsonResult(data.inbox_initial_state ?? data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXDmConversationTool(manager: XClientManager) {
  return {
    name: "x_dm_conversation",
    label: "X DM Conversation",
    description: "Get messages from a specific DM conversation on X (Twitter).",
    parameters: Type.Object({
      conversation_id: Type.String({
        description: "The conversation ID (e.g. '123456789-987654321' for 1-on-1 or a group ID).",
      }),
      max_id: Type.Optional(
        Type.String({
          description:
            "Fetch messages older than this message ID. Use for paginating backwards through history.",
        }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { conversation_id: string; max_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const session = manager.getCredentials(account)!;

      let url =
        `https://x.com/i/api/1.1/dm/conversation/${encodeURIComponent(params.conversation_id)}.json` +
        "?include_profile_interstitial_type=1" +
        "&include_blocking=1" +
        "&include_blocked_by=1" +
        "&include_followed_by=1" +
        "&include_want_retweets=1" +
        "&include_mute_edge=1" +
        "&include_can_dm=1" +
        "&include_can_media_tag=1" +
        "&include_ext_is_blue_verified=1" +
        "&skip_status=1" +
        "&dm_secret_conversations_enabled=false" +
        "&krs_registration_enabled=true" +
        "&cards_platform=Web-12" +
        "&include_cards=1" +
        "&include_ext_alt_text=true" +
        "&include_quote_count=true" +
        "&include_reply_count=1" +
        "&tweet_mode=extended" +
        "&include_ext_views=true" +
        "&dm_users=true" +
        "&include_groups=true" +
        "&include_ext_media_color=true" +
        "&supports_reactions=true";

      if (params.max_id) {
        url += `&max_id=${encodeURIComponent(params.max_id)}`;
      }

      try {
        const resp = await fetch(url, {
          method: "GET",
          headers: dmHeaders(session),
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(
            `X DM conversation HTTP error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await resp.json()) as any;
        return jsonResult(data.conversation_timeline ?? data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXDmSendTool(manager: XClientManager) {
  return {
    name: "x_dm_send",
    label: "X DM Send",
    description: "Send a direct message on X (Twitter).",
    parameters: Type.Object({
      conversation_id: Type.String({
        description: "The conversation ID to send the message into.",
      }),
      text: Type.String({ description: "The message text to send." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { conversation_id: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const session = manager.getCredentials(account)!;

      // Each DM send requires a unique request_id to prevent accidental duplicate
      // delivery if the client retries after a network error.
      const body = {
        conversation_id: params.conversation_id,
        recipient_ids: false,
        request_id: randomUUID(),
        text: params.text,
        cards_platform: "Web-12",
        include_cards: 1,
        include_quote_count: true,
        dm_users: false,
      };

      try {
        const resp = await fetch("https://x.com/i/api/1.1/dm/new2.json", {
          method: "POST",
          headers: dmHeaders(session),
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(
            `X DM send HTTP error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
          );
        }

        return jsonResult({ status: "sent", conversation_id: params.conversation_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
