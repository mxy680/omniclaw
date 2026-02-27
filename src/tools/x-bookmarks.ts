import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS, extractTimelineTweets } from "./x-utils.js";

export function createXGetBookmarksTool(manager: XClientManager) {
  return {
    name: "x_get_bookmarks",
    label: "X Get Bookmarks",
    description: "Get your bookmarked tweets on X (Twitter).",
    parameters: Type.Object({
      count: Type.Optional(Type.Number({ description: "Number of bookmarks to fetch. Defaults to 20.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor from previous response." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { count?: number; cursor?: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const variables: Record<string, unknown> = {
        count: params.count ?? 20,
        includePromotedContent: false,
      };
      if (params.cursor) variables.cursor = params.cursor;

      try {
        const data = (await manager.graphqlGet(
          account,
          "Bookmarks",
          QUERY_IDS.Bookmarks,
          variables,
        )) as Record<string, unknown>;
        const { tweets, cursor } = extractTimelineTweets(data, [
          "data",
          "bookmark_timeline_v2",
          "timeline",
        ]);
        return jsonResult({ count: tweets.length, tweets, next_cursor: cursor });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXAddBookmarkTool(manager: XClientManager) {
  return {
    name: "x_add_bookmark",
    label: "X Add Bookmark",
    description: "Bookmark a tweet on X (Twitter).",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet to bookmark." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        await manager.graphqlPost(
          account,
          "CreateBookmark",
          QUERY_IDS.CreateBookmark,
          { tweet_id: params.tweet_id },
        );
        return jsonResult({ status: "bookmarked", tweet_id: params.tweet_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXRemoveBookmarkTool(manager: XClientManager) {
  return {
    name: "x_remove_bookmark",
    label: "X Remove Bookmark",
    description: "Remove a bookmark from a tweet on X (Twitter).",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet to remove from bookmarks." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        await manager.graphqlPost(
          account,
          "DeleteBookmark",
          QUERY_IDS.DeleteBookmark,
          { tweet_id: params.tweet_id },
        );
        return jsonResult({ status: "unbookmarked", tweet_id: params.tweet_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
