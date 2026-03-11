import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

const FAVORITE_TWEET_QUERY_ID = "lI07N6Otwv1PhnEgXILM7A";
const FAVORITE_TWEET_OP = "FavoriteTweet";
const UNFAVORITE_TWEET_QUERY_ID = "ZYKSe-w7KEslx3JhSIk5LA";
const UNFAVORITE_TWEET_OP = "UnfavoriteTweet";
const CREATE_RETWEET_QUERY_ID = "mbRO74GrOvSfRcJnlMapnQ";
const CREATE_RETWEET_OP = "CreateRetweet";
const DELETE_RETWEET_QUERY_ID = "ZyZigVsNiFO6v1dEks1eWg";
const DELETE_RETWEET_OP = "DeleteRetweet";
const CREATE_BOOKMARK_QUERY_ID = "aoDbu3RHznuiSkQ9aNM67Q";
const CREATE_BOOKMARK_OP = "CreateBookmark";
const DELETE_BOOKMARK_QUERY_ID = "Wlmlj2-xzyS1GN3a6cj-mQ";
const DELETE_BOOKMARK_OP = "DeleteBookmark";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function interactionTool(
  name: string,
  label: string,
  description: string,
  queryId: string,
  operationName: string,
  manager: XClientManager,
): any {
  return {
    name,
    label,
    description,
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The tweet ID." }),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        await client.graphql({
          queryId,
          operationName,
          variables: { tweet_id: params.tweet_id },
        });
        return jsonResult({ success: true, tweet_id: params.tweet_id });
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
export function createXTweetLikeTool(manager: XClientManager): any {
  return interactionTool(
    "x_tweet_like", "X Tweet Like", "Like a tweet.",
    FAVORITE_TWEET_QUERY_ID, FAVORITE_TWEET_OP, manager,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTweetUnlikeTool(manager: XClientManager): any {
  return interactionTool(
    "x_tweet_unlike", "X Tweet Unlike", "Unlike a previously liked tweet.",
    UNFAVORITE_TWEET_QUERY_ID, UNFAVORITE_TWEET_OP, manager,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTweetRetweetTool(manager: XClientManager): any {
  return interactionTool(
    "x_tweet_retweet", "X Retweet", "Retweet a tweet.",
    CREATE_RETWEET_QUERY_ID, CREATE_RETWEET_OP, manager,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTweetUnretweetTool(manager: XClientManager): any {
  return interactionTool(
    "x_tweet_unretweet", "X Unretweet", "Undo a retweet.",
    DELETE_RETWEET_QUERY_ID, DELETE_RETWEET_OP, manager,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTweetBookmarkTool(manager: XClientManager): any {
  return interactionTool(
    "x_tweet_bookmark", "X Bookmark", "Bookmark a tweet.",
    CREATE_BOOKMARK_QUERY_ID, CREATE_BOOKMARK_OP, manager,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTweetUnbookmarkTool(manager: XClientManager): any {
  return interactionTool(
    "x_tweet_unbookmark", "X Unbookmark", "Remove a tweet from bookmarks.",
    DELETE_BOOKMARK_QUERY_ID, DELETE_BOOKMARK_OP, manager,
  );
}
