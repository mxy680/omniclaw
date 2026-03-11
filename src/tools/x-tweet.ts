import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

const TWEET_DETAIL_QUERY_ID = "1eAGnXrtvTBUePpQfTXZzA";
const TWEET_DETAIL_OP = "TweetDetail";
const CREATE_TWEET_QUERY_ID = "RXKQMYyEqEjGgWpcSP6LBw";
const CREATE_TWEET_OP = "CreateTweet";
const DELETE_TWEET_QUERY_ID = "nxpZCY2K-I6QoFHAHeojFQ";
const DELETE_TWEET_OP = "DeleteTweet";
const CREATE_TWEET_REPLY_QUERY_ID = "RXKQMYyEqEjGgWpcSP6LBw";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTweetDetail(result: any): unknown {
  const instructions = result?.data?.tweetResult?.result?.tweet
    ? [result.data.tweetResult.result]
    : result?.data?.threaded_conversation_with_injections_v2?.instructions ?? [];

  for (const instruction of instructions) {
    if (instruction.type === "TimelineAddEntries") {
      for (const entry of instruction.entries ?? []) {
        const tweet = entry?.content?.itemContent?.tweet_results?.result;
        if (tweet) {
          const t = tweet.tweet ?? tweet;
          const legacy = t.legacy ?? {};
          const user = t.core?.user_results?.result?.legacy ?? {};
          return {
            id: legacy.id_str ?? t.rest_id,
            text: legacy.full_text ?? t.note_tweet?.note_tweet_results?.result?.text,
            created_at: legacy.created_at,
            author: {
              username: user.screen_name,
              name: user.name,
              id: t.core?.user_results?.result?.rest_id,
            },
            metrics: {
              likes: legacy.favorite_count,
              retweets: legacy.retweet_count,
              replies: legacy.reply_count,
              quotes: legacy.quote_count,
              bookmarks: legacy.bookmark_count,
              views: t.views?.count,
            },
            in_reply_to: legacy.in_reply_to_status_id_str ?? null,
          };
        }
      }
    }
    // Direct result path
    const t = instruction.tweet ?? instruction;
    if (t.legacy || t.rest_id) {
      const legacy = t.legacy ?? {};
      const user = t.core?.user_results?.result?.legacy ?? {};
      return {
        id: legacy.id_str ?? t.rest_id,
        text: legacy.full_text ?? t.note_tweet?.note_tweet_results?.result?.text,
        created_at: legacy.created_at,
        author: {
          username: user.screen_name,
          name: user.name,
        },
        metrics: {
          likes: legacy.favorite_count,
          retweets: legacy.retweet_count,
          replies: legacy.reply_count,
        },
      };
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTweetGetTool(manager: XClientManager): any {
  return {
    name: "x_tweet_get",
    label: "X Tweet Get",
    description: "Get a specific tweet by its ID. Returns the tweet text, author, and engagement metrics.",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The tweet ID." }),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.graphql({
          queryId: TWEET_DETAIL_QUERY_ID,
          operationName: TWEET_DETAIL_OP,
          variables: {
            focalTweetId: params.tweet_id,
            with_rux_injections: false,
            includePromotedContent: false,
            withCommunity: true,
            withQuickPromoteEligibilityTweetFields: false,
            withBirdwatchNotes: true,
            withVoice: true,
            withV2Timeline: true,
          },
          method: "GET",
        });
        const tweet = extractTweetDetail(result);
        if (!tweet) {
          return jsonResult({ error: "tweet_not_found", tweet_id: params.tweet_id });
        }
        return jsonResult(tweet);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTweetCreateTool(manager: XClientManager): any {
  return {
    name: "x_tweet_create",
    label: "X Tweet Create",
    description: "Post a new tweet.",
    parameters: Type.Object({
      text: Type.String({ description: "The tweet text (max 280 characters)." }),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { text: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.graphql({
          queryId: CREATE_TWEET_QUERY_ID,
          operationName: CREATE_TWEET_OP,
          variables: {
            tweet_text: params.text,
            dark_request: false,
            media: { media_entities: [], possibly_sensitive: false },
            semantic_annotation_ids: [],
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gqlErrors = (result as any)?.errors;
        if (Array.isArray(gqlErrors) && gqlErrors.length > 0) {
          return jsonResult({ error: "tweet_create_failed", message: gqlErrors[0].message });
        }
        const tweet = (result as any)?.data?.create_tweet?.tweet_results?.result;
        const legacy = tweet?.legacy ?? {};
        return jsonResult({
          id: legacy.id_str ?? tweet?.rest_id,
          text: legacy.full_text,
          created_at: legacy.created_at,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTweetDeleteTool(manager: XClientManager): any {
  return {
    name: "x_tweet_delete",
    label: "X Tweet Delete",
    description: "Delete a tweet by its ID.",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The tweet ID to delete." }),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        await client.graphql({
          queryId: DELETE_TWEET_QUERY_ID,
          operationName: DELETE_TWEET_OP,
          variables: { tweet_id: params.tweet_id, dark_request: false },
        });
        return jsonResult({ deleted: true, tweet_id: params.tweet_id });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTweetReplyTool(manager: XClientManager): any {
  return {
    name: "x_tweet_reply",
    label: "X Tweet Reply",
    description: "Reply to a tweet.",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The tweet ID to reply to." }),
      text: Type.String({ description: "The reply text." }),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; text: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.graphql({
          queryId: CREATE_TWEET_REPLY_QUERY_ID,
          operationName: CREATE_TWEET_OP,
          variables: {
            tweet_text: params.text,
            reply: { in_reply_to_tweet_id: params.tweet_id, exclude_reply_user_ids: [] },
            dark_request: false,
            media: { media_entities: [], possibly_sensitive: false },
            semantic_annotation_ids: [],
          },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gqlErrors = (result as any)?.errors;
        if (Array.isArray(gqlErrors) && gqlErrors.length > 0) {
          return jsonResult({ error: "tweet_reply_failed", message: gqlErrors[0].message });
        }
        const tweet = (result as any)?.data?.create_tweet?.tweet_results?.result;
        const legacy = tweet?.legacy ?? {};
        return jsonResult({
          id: legacy.id_str ?? tweet?.rest_id,
          text: legacy.full_text,
          in_reply_to: params.tweet_id,
          created_at: legacy.created_at,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
