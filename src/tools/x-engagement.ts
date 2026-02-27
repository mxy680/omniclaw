import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS } from "./x-utils.js";

function createEngagementTool(
  name: string,
  label: string,
  description: string,
  operationName: string,
  queryId: string,
  variableKey: string,
  statusVerb: string,
  manager: XClientManager,
) {
  return {
    name,
    label,
    description,
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        await manager.graphqlPost(account, operationName, queryId, {
          [variableKey]: params.tweet_id,
        });
        return jsonResult({ status: statusVerb, tweet_id: params.tweet_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXLikeTool(manager: XClientManager) {
  return createEngagementTool(
    "x_like", "X Like", "Like a tweet on X (Twitter).",
    "FavoriteTweet", QUERY_IDS.FavoriteTweet, "tweet_id", "liked", manager,
  );
}

export function createXUnlikeTool(manager: XClientManager) {
  return createEngagementTool(
    "x_unlike", "X Unlike", "Unlike a previously liked tweet on X (Twitter).",
    "UnfavoriteTweet", QUERY_IDS.UnfavoriteTweet, "tweet_id", "unliked", manager,
  );
}

export function createXRetweetTool(manager: XClientManager) {
  return createEngagementTool(
    "x_retweet", "X Retweet", "Retweet a tweet on X (Twitter).",
    "CreateRetweet", QUERY_IDS.CreateRetweet, "tweet_id", "retweeted", manager,
  );
}

export function createXUnretweetTool(manager: XClientManager) {
  return createEngagementTool(
    "x_unretweet", "X Unretweet", "Remove a retweet on X (Twitter).",
    "DeleteRetweet", QUERY_IDS.DeleteRetweet, "source_tweet_id", "unretweeted", manager,
  );
}
