import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS, extractTimelineTweets } from "./x-utils.js";

export function createXSearchTool(manager: XClientManager) {
  return {
    name: "x_search",
    label: "X Search",
    description:
      "Search X (Twitter) for tweets. Supports all X search operators: from:user, to:user, @user, #hashtag, \"exact phrase\", since:YYYY-MM-DD, until:YYYY-MM-DD, filter:links, filter:images, min_retweets:N, etc.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query using X search syntax." }),
      type: Type.Optional(
        Type.String({
          description: "Search tab: 'top', 'latest', 'people', 'photos', 'videos'. Defaults to 'top'.",
          default: "top",
        }),
      ),
      count: Type.Optional(Type.Number({ description: "Number of results. Defaults to 20.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor from previous response." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; type?: string; count?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const productMap: Record<string, string> = {
        top: "Top",
        latest: "Latest",
        people: "People",
        photos: "Photos",
        videos: "Videos",
      };
      const product = productMap[params.type ?? "top"] ?? "Top";

      const variables: Record<string, unknown> = {
        rawQuery: params.query,
        count: params.count ?? 20,
        querySource: "typed_query",
        product,
      };
      if (params.cursor) variables.cursor = params.cursor;

      try {
        // SearchTimeline requires POST (not GET) and fieldToggles
        const data = (await manager.graphqlPost(
          account,
          "SearchTimeline",
          QUERY_IDS.SearchTimeline,
          variables,
          undefined,
          {
            withPayments: false,
            withAuxiliaryUserLabels: false,
            withArticleRichContentState: false,
            withArticlePlainText: false,
            withGrokAnalyze: false,
            withDisallowedReplyControls: false,
          },
        )) as Record<string, unknown>;
        const { tweets, cursor } = extractTimelineTweets(data, [
          "data",
          "search_by_raw_query",
          "search_timeline",
          "timeline",
        ]);
        return jsonResult({ query: params.query, type: product, count: tweets.length, tweets, next_cursor: cursor });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
