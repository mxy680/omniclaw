import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

const BOOKMARKS_QUERY_ID = "c-7G4ohSLIuTcfa5Mn5qdw";
const BOOKMARKS_OP = "Bookmarks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXBookmarksListTool(manager: XClientManager): any {
  return {
    name: "x_bookmarks_list",
    label: "X Bookmarks List",
    description: "List the authenticated user's bookmarked tweets.",
    parameters: Type.Object({
      count: Type.Optional(Type.Number({ description: "Number of bookmarks.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor." })),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const variables: Record<string, unknown> = {
          count: params.count ?? 20,
          includePromotedContent: false,
        };
        if (params.cursor) variables.cursor = params.cursor;

        const result = await client.graphql({
          queryId: BOOKMARKS_QUERY_ID,
          operationName: BOOKMARKS_OP,
          variables,
          method: "GET",
        });

        const tweets: unknown[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instructions = (result as any)?.data?.bookmark_timeline_v2?.timeline?.instructions ?? [];
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

        return jsonResult({ bookmarks: tweets });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
