import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS } from "./x-utils.js";

export function createXPostTweetTool(manager: XClientManager) {
  return {
    name: "x_post_tweet",
    label: "X Post Tweet",
    description: "Post a new tweet on X (Twitter).",
    parameters: Type.Object({
      text: Type.String({ description: "The tweet text. Max 280 characters for standard accounts." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { text: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const variables = {
        tweet_text: params.text,
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await manager.graphqlPost(
          account,
          "CreateTweet",
          QUERY_IDS.CreateTweet,
          variables,
        )) as any;
        const result = data?.data?.create_tweet?.tweet_results?.result;
        const legacy = result?.legacy;
        // X may return errors alongside data (e.g., automation detection)
        if (!result && data?.errors) {
          const errMsg = (data.errors as Array<{ message?: string }>)?.[0]?.message;
          return jsonResult({ error: errMsg ?? "CreateTweet returned errors", errors: data.errors });
        }
        return jsonResult({
          status: "posted",
          tweet_id: legacy?.id_str ?? result?.rest_id,
          text: legacy?.full_text ?? params.text,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXDeleteTweetTool(manager: XClientManager) {
  return {
    name: "x_delete_tweet",
    label: "X Delete Tweet",
    description: "Delete one of your tweets on X (Twitter).",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet to delete." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        await manager.graphqlPost(account, "DeleteTweet", QUERY_IDS.DeleteTweet, {
          tweet_id: params.tweet_id,
          dark_request: false,
        });
        return jsonResult({ status: "deleted", tweet_id: params.tweet_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXReplyTool(manager: XClientManager) {
  return {
    name: "x_reply",
    label: "X Reply",
    description: "Reply to a tweet on X (Twitter).",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet to reply to." }),
      text: Type.String({ description: "The reply text." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; text: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const variables = {
        tweet_text: params.text,
        reply: { in_reply_to_tweet_id: params.tweet_id, exclude_reply_user_ids: [] },
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await manager.graphqlPost(
          account,
          "CreateTweet",
          QUERY_IDS.CreateTweet,
          variables,
        )) as any;
        const result = data?.data?.create_tweet?.tweet_results?.result;
        const legacy = result?.legacy;
        if (!result && data?.errors) {
          const errMsg = (data.errors as Array<{ message?: string }>)?.[0]?.message;
          return jsonResult({ error: errMsg ?? "CreateTweet returned errors", errors: data.errors });
        }
        return jsonResult({
          status: "replied",
          tweet_id: legacy?.id_str ?? result?.rest_id,
          in_reply_to: params.tweet_id,
          text: legacy?.full_text ?? params.text,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
