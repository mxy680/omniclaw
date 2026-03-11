import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

const LISTS_MEMBERSHIPS_QUERY_ID = "3HVC3dmZ7C-zFXkps66_8g";
const LISTS_MEMBERSHIPS_OP = "ListsManagementPageTimeline";
const LIST_LATEST_TWEETS_QUERY_ID = "gNXkRRRV67cSRJkmpgGPnA";
const LIST_LATEST_TWEETS_OP = "ListLatestTweetsTimeline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXListsGetTool(manager: XClientManager): any {
  return {
    name: "x_lists_get",
    label: "X Lists Get",
    description: "Get the authenticated user's lists (owned and subscribed).",
    parameters: Type.Object({
      count: Type.Optional(Type.Number({ description: "Number of lists.", default: 50 })),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.graphql({
          queryId: LISTS_MEMBERSHIPS_QUERY_ID,
          operationName: LISTS_MEMBERSHIPS_OP,
          variables: { count: params.count ?? 50 },
          method: "GET",
        });

        const lists: unknown[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instructions = (result as any)?.data?.viewer?.list_management_timeline?.timeline?.instructions ?? [];
        for (const instruction of instructions) {
          if (instruction.type !== "TimelineAddEntries") continue;
          for (const entry of instruction.entries ?? []) {
            const listResult = entry?.content?.itemContent?.list;
            if (!listResult) continue;
            lists.push({
              id: listResult.id_str,
              name: listResult.name,
              description: listResult.description,
              member_count: listResult.member_count,
              subscriber_count: listResult.subscriber_count,
              mode: listResult.mode,
              created_at: listResult.created_at,
            });
          }
        }

        return jsonResult({ lists });
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
export function createXListTimelineTool(manager: XClientManager): any {
  return {
    name: "x_list_timeline",
    label: "X List Timeline",
    description: "Get the latest tweets from a list.",
    parameters: Type.Object({
      list_id: Type.String({ description: "The list ID." }),
      count: Type.Optional(Type.Number({ description: "Number of tweets.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor." })),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { list_id: string; count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const variables: Record<string, unknown> = {
          listId: params.list_id,
          count: params.count ?? 20,
        };
        if (params.cursor) variables.cursor = params.cursor;

        const result = await client.graphql({
          queryId: LIST_LATEST_TWEETS_QUERY_ID,
          operationName: LIST_LATEST_TWEETS_OP,
          variables,
          method: "GET",
        });

        const tweets: unknown[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instructions = (result as any)?.data?.list?.tweets_timeline?.timeline?.instructions ?? [];
        for (const instruction of instructions) {
          if (instruction.type !== "TimelineAddEntries") continue;
          for (const entry of instruction.entries ?? []) {
            const tweetResult = entry?.content?.itemContent?.tweet_results?.result;
            if (!tweetResult) continue;
            const tweet = tweetResult.tweet ?? tweetResult;
            const legacy = tweet.legacy ?? {};
            const user = tweet.core?.user_results?.result?.legacy ?? {};
            tweets.push({
              id: legacy.id_str ?? tweet.rest_id,
              text: legacy.full_text,
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
            });
          }
        }

        return jsonResult({ list_id: params.list_id, tweets });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
