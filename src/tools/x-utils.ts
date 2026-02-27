// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

export function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call x_auth_setup to authenticate with X (Twitter) first.",
};

/** GraphQL query IDs — extracted from X's web client JS bundles. Update when X deploys changes. */
export const QUERY_IDS = {
  // Queries (GET)
  HomeTimeline: "c-CzHF1LboFilMpsx4ZCrQ",
  HomeLatestTimeline: "BKB7oi212Fi7kQtCBGE4zA",
  UserByScreenName: "1VOOyvKkiI3FMmkeDNxM9A",
  UserTweets: "q6xj5bs0hapm9309hexA_g",
  SearchTimeline: "VhUd6vHVmLBcw0uX-6jMLA",
  TweetDetail: "xd_EMdYvB9hfZsZ6Idri0w",
  Bookmarks: "2neUNDqrrFzbLui8yallcQ",
  // Mutations (POST)
  CreateTweet: "IID9x6WsdMnTlXnzXGq8ng",
  DeleteTweet: "VaenaVgh5q5ih7kvyVjgtg",
  FavoriteTweet: "lI07N6Otwv1PhnEgXILM7A",
  UnfavoriteTweet: "ZYKSe-w7KEslx3JhSIk5LA",
  CreateRetweet: "ojPdsZsimiJrUGLR1sjUtA",
  DeleteRetweet: "iQtK4dl5hBmXewYZuEOKVw",
  CreateBookmark: "aoDbu3RHznuiSkQ9aNM67Q",
  DeleteBookmark: "Wlmlj2-xzyS1GN3a6cj-mQ",
} as const;

/**
 * Extract tweet data from the nested GraphQL response.
 * X wraps tweets in layers: content -> itemContent -> tweet_results -> result
 */
export function extractTweet(entry: Record<string, unknown>): Record<string, unknown> | null {
  const content = entry.content as Record<string, unknown> | undefined;
  const itemContent = (content?.itemContent ?? content?.tweetResult) as
    | Record<string, unknown>
    | undefined;
  const tweetResults = (itemContent?.tweet_results ?? itemContent) as
    | Record<string, unknown>
    | undefined;
  const result = tweetResults?.result as Record<string, unknown> | undefined;

  if (!result) return null;

  // Handle "TweetWithVisibilityResults" wrapper
  const tweet = (
    result.__typename === "TweetWithVisibilityResults"
      ? (result.tweet as Record<string, unknown>)
      : result
  ) as Record<string, unknown> | undefined;

  if (!tweet?.legacy) return null;

  const legacy = tweet.legacy as Record<string, unknown>;
  const core = tweet.core as Record<string, unknown> | undefined;
  const userResults = core?.user_results as Record<string, unknown> | undefined;
  const userResult = userResults?.result as Record<string, unknown> | undefined;
  const userLegacy = userResult?.legacy as Record<string, unknown> | undefined;

  return {
    id: legacy.id_str ?? tweet.rest_id,
    text: legacy.full_text,
    created_at: legacy.created_at,
    author: userLegacy
      ? {
          id: userResult?.rest_id,
          name: userLegacy.name,
          screen_name: userLegacy.screen_name,
          verified: userLegacy.verified,
        }
      : undefined,
    retweet_count: legacy.retweet_count,
    favorite_count: legacy.favorite_count,
    reply_count: legacy.reply_count,
    quote_count: legacy.quote_count,
    bookmark_count: legacy.bookmark_count,
    favorited: legacy.favorited,
    retweeted: legacy.retweeted,
    bookmarked: legacy.bookmarked,
    lang: legacy.lang,
    in_reply_to_status_id: legacy.in_reply_to_status_id_str,
    in_reply_to_screen_name: legacy.in_reply_to_screen_name,
  };
}

/**
 * Extract tweets from a timeline-style GraphQL response.
 * Handles the timeline -> instructions -> entries pattern.
 */
export function extractTimelineTweets(
  data: Record<string, unknown>,
  timelinePath: string[],
): { tweets: Record<string, unknown>[]; cursor?: string } {
  let timeline: Record<string, unknown> = data;
  for (const key of timelinePath) {
    timeline = (timeline[key] as Record<string, unknown>) ?? {};
  }

  const instructions = (timeline.instructions as Array<Record<string, unknown>>) ?? [];
  const tweets: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  for (const instruction of instructions) {
    const entries = (instruction.entries as Array<Record<string, unknown>>) ?? [];
    for (const entry of entries) {
      const entryId = entry.entryId as string;

      if (entryId?.startsWith("tweet-") || entryId?.startsWith("promoted")) {
        const tweet = extractTweet(entry);
        if (tweet) tweets.push(tweet);
      } else if (entryId?.startsWith("cursor-bottom-")) {
        const entryContent = entry.content as Record<string, unknown> | undefined;
        cursor = entryContent?.value as string | undefined;
      }
    }

    const moduleItems = (instruction.moduleItems as Array<Record<string, unknown>>) ?? [];
    for (const item of moduleItems) {
      const tweet = extractTweet(item);
      if (tweet) tweets.push(tweet);
    }
  }

  return { tweets, cursor };
}

/**
 * Extract user profile from UserByScreenName response.
 */
export function extractUser(data: Record<string, unknown>): Record<string, unknown> | null {
  const dataObj = data?.data as Record<string, unknown> | undefined;
  const userResult = (dataObj?.user as Record<string, unknown>)?.result as
    | Record<string, unknown>
    | undefined;
  if (!userResult) return null;

  const legacy = userResult.legacy as Record<string, unknown> | undefined;
  if (!legacy) return null;

  return {
    id: userResult.rest_id,
    name: legacy.name,
    screen_name: legacy.screen_name,
    description: legacy.description,
    location: legacy.location,
    url: legacy.url,
    followers_count: legacy.followers_count,
    following_count: legacy.friends_count,
    tweet_count: legacy.statuses_count,
    listed_count: legacy.listed_count,
    created_at: legacy.created_at,
    verified: legacy.verified,
    is_blue_verified: userResult.is_blue_verified,
    profile_image_url: legacy.profile_image_url_https,
    profile_banner_url: legacy.profile_banner_url,
    pinned_tweet_ids: legacy.pinned_tweet_ids_str,
  };
}
