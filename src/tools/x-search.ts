import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

const SEARCH_TIMELINE_QUERY_ID = "gkjsKepM6gl_HmFWoWKfgg";
const SEARCH_TIMELINE_OP = "SearchTimeline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXSearchTool(manager: XClientManager): any {
  return {
    name: "x_search",
    label: "X Search",
    description: "Search for tweets on X (Twitter). Supports standard Twitter search operators.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query. Supports operators like 'from:user', '#hashtag', 'min_faves:100'." }),
      count: Type.Optional(Type.Number({ description: "Number of results.", default: 20 })),
      type: Type.Optional(Type.String({
        description: "Search type: 'Top', 'Latest', 'People', 'Photos', 'Videos'.",
        default: "Top",
      })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor." })),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; count?: number; type?: string; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const variables: Record<string, unknown> = {
          rawQuery: params.query,
          count: params.count ?? 20,
          querySource: "typed_query",
          product: params.type ?? "Top",
        };
        if (params.cursor) variables.cursor = params.cursor;

        const result = await client.graphql({
          queryId: SEARCH_TIMELINE_QUERY_ID,
          operationName: SEARCH_TIMELINE_OP,
          variables,
          method: "GET",
        });

        const tweets: unknown[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instructions = (result as any)?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions ?? [];
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
              text: legacy.full_text ?? tweet.note_tweet?.note_tweet_results?.result?.text,
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

        return jsonResult({ query: params.query, tweets });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
