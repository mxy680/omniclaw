import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS, extractTimelineTweets } from "./x-utils.js";

export function createXGetTimelineTool(manager: XClientManager) {
  return {
    name: "x_get_timeline",
    label: "X Get Timeline",
    description:
      "Get the home timeline from X (Twitter). Returns recent tweets from accounts you follow. Supports 'Following' (chronological) and 'For You' (algorithmic) tabs.",
    parameters: Type.Object({
      tab: Type.Optional(
        Type.String({
          description: "'following' for chronological, 'foryou' for algorithmic. Defaults to 'following'.",
          default: "following",
        }),
      ),
      count: Type.Optional(Type.Number({ description: "Number of tweets to fetch. Defaults to 20.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor from previous response." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { tab?: string; count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const tab = params.tab ?? "following";
      const isForYou = tab === "foryou";
      const queryId = isForYou ? QUERY_IDS.HomeTimeline : QUERY_IDS.HomeLatestTimeline;
      const operationName = isForYou ? "HomeTimeline" : "HomeLatestTimeline";

      const variables: Record<string, unknown> = {
        count: params.count ?? 20,
        includePromotedContent: false,
        latestControlAvailable: true,
        requestContext: "launch",
      };
      if (params.cursor) variables.cursor = params.cursor;

      try {
        const data = (await manager.graphqlGet(account, operationName, queryId, variables)) as Record<string, unknown>;
        const { tweets, cursor } = extractTimelineTweets(data, [
          "data",
          "home",
          "home_timeline_urt",
        ]);
        return jsonResult({ count: tweets.length, tweets, next_cursor: cursor });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXGetUserTweetsTool(manager: XClientManager) {
  return {
    name: "x_get_user_tweets",
    label: "X Get User Tweets",
    description: "Get tweets posted by a specific X (Twitter) user. Provide either user_id or screen_name.",
    parameters: Type.Object({
      user_id: Type.Optional(Type.String({ description: "The user's numeric ID." })),
      screen_name: Type.Optional(Type.String({ description: "The user's @handle (without the @)." })),
      count: Type.Optional(Type.Number({ description: "Number of tweets to fetch. Defaults to 20.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor from previous response." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { user_id?: string; screen_name?: string; count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        let userId = params.user_id;
        if (!userId && params.screen_name) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const userData = (await manager.graphqlGet(
            account,
            "UserByScreenName",
            QUERY_IDS.UserByScreenName,
            { screen_name: params.screen_name, withSafetyModeUserFields: true },
          )) as any;
          userId = userData?.data?.user?.result?.rest_id;
          if (!userId) return jsonResult({ error: `User @${params.screen_name} not found.` });
        }

        if (!userId) return jsonResult({ error: "Provide either user_id or screen_name." });

        const variables: Record<string, unknown> = {
          userId,
          count: params.count ?? 20,
          includePromotedContent: false,
          withQuickPromoteEligibilityTweetFields: true,
          withVoice: true,
          withV2Timeline: true,
        };
        if (params.cursor) variables.cursor = params.cursor;

        const data = (await manager.graphqlGet(
          account,
          "UserTweets",
          QUERY_IDS.UserTweets,
          variables,
        )) as Record<string, unknown>;

        // X API may return timeline under either "timeline_v2" or "timeline"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userResult = (data as any)?.data?.user?.result as Record<string, unknown> | undefined;
        const timelineKey = userResult?.timeline_v2 ? "timeline_v2" : "timeline";
        const { tweets, cursor } = extractTimelineTweets(data, [
          "data",
          "user",
          "result",
          timelineKey,
          "timeline",
        ]);
        return jsonResult({ count: tweets.length, tweets, next_cursor: cursor });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
