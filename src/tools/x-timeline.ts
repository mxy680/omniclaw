import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

const HOME_TIMELINE_QUERY_ID = "gXtpuBkna6SRLFFKaT2OTg";
const HOME_TIMELINE_OP = "HomeTimeline";
const USER_TWEETS_QUERY_ID = "5M8UuGym7_VyIEggQIyjxQ";
const USER_TWEETS_OP = "UserTweets";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTweets(timeline: any): unknown[] {
  const tweets: unknown[] = [];
  const instructions = timeline?.data?.home?.home_timeline_urt?.instructions
    ?? timeline?.data?.user?.result?.timeline_v2?.timeline?.instructions
    ?? [];
  for (const instruction of instructions) {
    if (instruction.type !== "TimelineAddEntries") continue;
    for (const entry of instruction.entries ?? []) {
      const result = entry?.content?.itemContent?.tweet_results?.result;
      if (!result) continue;
      const tweet = result.tweet ?? result;
      const legacy = tweet.legacy ?? {};
      const user = tweet.core?.user_results?.result?.legacy ?? {};
      tweets.push({
        id: legacy.id_str ?? tweet.rest_id,
        text: legacy.full_text ?? tweet.note_tweet?.note_tweet_results?.result?.text,
        created_at: legacy.created_at,
        author: {
          username: user.screen_name,
          name: user.name,
          verified: tweet.core?.user_results?.result?.is_blue_verified,
        },
        metrics: {
          likes: legacy.favorite_count,
          retweets: legacy.retweet_count,
          replies: legacy.reply_count,
          quotes: legacy.quote_count,
          bookmarks: legacy.bookmark_count,
          views: tweet.views?.count,
        },
        in_reply_to: legacy.in_reply_to_status_id_str ?? null,
        is_retweet: !!legacy.retweeted_status_result,
      });
    }
  }
  return tweets;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXTimelineHomeTool(manager: XClientManager): any {
  return {
    name: "x_timeline_home",
    label: "X Home Timeline",
    description: "Get the authenticated user's home timeline (For You / Following feed).",
    parameters: Type.Object({
      count: Type.Optional(Type.Number({ description: "Number of tweets to fetch.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor for next page." })),
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
          latestControlAvailable: true,
          requestContext: "launch",
        };
        if (params.cursor) variables.cursor = params.cursor;

        const result = await client.graphql({
          queryId: HOME_TIMELINE_QUERY_ID,
          operationName: HOME_TIMELINE_OP,
          variables,
        });
        return jsonResult({ tweets: extractTweets(result) });
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
export function createXTimelineUserTool(manager: XClientManager): any {
  return {
    name: "x_timeline_user",
    label: "X User Timeline",
    description: "Get a user's tweets by their user ID.",
    parameters: Type.Object({
      user_id: Type.String({ description: "The user's numeric ID. Get this from x_profile_get." }),
      count: Type.Optional(Type.Number({ description: "Number of tweets to fetch.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor for next page." })),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { user_id: string; count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const variables: Record<string, unknown> = {
          userId: params.user_id,
          count: params.count ?? 20,
          includePromotedContent: false,
          withQuickPromoteEligibilityTweetFields: false,
          withVoice: true,
          withV2Timeline: true,
        };
        if (params.cursor) variables.cursor = params.cursor;

        const result = await client.graphql({
          queryId: USER_TWEETS_QUERY_ID,
          operationName: USER_TWEETS_OP,
          variables,
          method: "GET",
        });
        return jsonResult({ tweets: extractTweets(result) });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
