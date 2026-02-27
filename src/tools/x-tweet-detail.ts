import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS, extractTimelineTweets } from "./x-utils.js";

export function createXGetTweetDetailTool(manager: XClientManager) {
  return {
    name: "x_get_tweet_detail",
    label: "X Get Tweet Detail",
    description:
      "Get full details of a specific tweet on X (Twitter), including engagement stats and reply thread.",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet to fetch." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const data = (await manager.graphqlGet(
          account,
          "TweetDetail",
          QUERY_IDS.TweetDetail,
          {
            focalTweetId: params.tweet_id,
            with_rux_injections: false,
            rankingMode: "Relevance",
            includePromotedContent: false,
            withCommunity: true,
            withQuickPromoteEligibilityTweetFields: true,
            withBirdwatchNotes: true,
            withVoice: true,
          },
        )) as Record<string, unknown>;

        const { tweets } = extractTimelineTweets(data, [
          "data",
          "tweetDetail",
          "threaded_conversation_with_injections_v2",
        ]);

        // The focal tweet is the first entry whose id matches; the rest are replies.
        const tweet = tweets.find((t) => (t.id as string) === params.tweet_id) ?? tweets[0] ?? null;
        const replies = tweets.filter((t) => t !== tweet);

        return jsonResult({ tweet, replies, reply_count: replies.length });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
