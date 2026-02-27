# X (Twitter) Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full read-write X (Twitter) integration with ~15 tools using browser session auth and direct HTTP to X's internal GraphQL API.

**Architecture:** Playwright login captures `auth_token` + `ct0` cookies. All API calls use direct `fetch()` to `https://x.com/i/api/graphql/<queryId>/<operationName>` with the static public bearer token + CSRF header. Follows the same ClientManager + auth tool + specialized tools pattern as Slack.

**Tech Stack:** TypeScript, Playwright (login only), fetch (API calls), @sinclair/typebox (parameter schemas)

---

### Task 1: Create XClientManager

**Files:**
- Create: `src/auth/x-client-manager.ts`

**Step 1: Write the XClientManager**

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface XSession {
  auth_token: string;
  ct0: string;
  username?: string;
  user_id?: string;
  cookie_details?: Array<{ name: string; value: string; domain: string; path: string }>;
}

interface XSessionFile {
  [account: string]: XSession;
}

const GRAPHQL_BASE = "https://x.com/i/api/graphql";
const BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

/** Default features sent with most GraphQL requests */
const DEFAULT_FEATURES: Record<string, boolean> = {
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

export class XClientManager {
  constructor(private tokensPath: string) {}

  private load(): XSessionFile {
    if (!existsSync(this.tokensPath)) return {};
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as XSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: XSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: XSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): XSession | null {
    return this.load()[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const s = this.getCredentials(account);
    return s !== null && s.auth_token !== "" && s.ct0 !== "";
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  private buildHeaders(session: XSession): Record<string, string> {
    return {
      Authorization: `Bearer ${BEARER_TOKEN}`,
      "x-csrf-token": session.ct0,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      Cookie: `auth_token=${session.auth_token}; ct0=${session.ct0}`,
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };
  }

  /**
   * Makes a GraphQL query (GET) to X's internal API.
   * Used for timeline, search, profile fetches.
   */
  async graphqlGet(
    account: string,
    operationName: string,
    queryId: string,
    variables: Record<string, unknown>,
    features?: Record<string, boolean>,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify({ ...DEFAULT_FEATURES, ...features }),
    });

    const url = `${GRAPHQL_BASE}/${queryId}/${operationName}?${params.toString()}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: this.buildHeaders(session),
    });

    if (resp.status === 429) {
      throw new Error("X API rate limit exceeded. Wait before retrying.");
    }
    if (resp.status === 401) {
      throw new Error("X session expired. Call x_auth_setup to re-authenticate.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`X API HTTP error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`);
    }

    return resp.json();
  }

  /**
   * Makes a GraphQL mutation (POST) to X's internal API.
   * Used for creating tweets, likes, retweets, follows, etc.
   */
  async graphqlPost(
    account: string,
    operationName: string,
    queryId: string,
    variables: Record<string, unknown>,
    features?: Record<string, boolean>,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const url = `${GRAPHQL_BASE}/${queryId}/${operationName}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(session),
      body: JSON.stringify({
        variables,
        features: { ...DEFAULT_FEATURES, ...features },
        queryId,
      }),
    });

    if (resp.status === 429) {
      throw new Error("X API rate limit exceeded. Wait before retrying.");
    }
    if (resp.status === 401) {
      throw new Error("X session expired. Call x_auth_setup to re-authenticate.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`X API HTTP error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`);
    }

    return resp.json();
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/auth/x-client-manager.ts`

**Step 3: Commit**

```bash
git add src/auth/x-client-manager.ts
git commit -m "feat(x): add XClientManager with GraphQL GET/POST methods"
```

---

### Task 2: Create x-utils.ts

**Files:**
- Create: `src/tools/x-utils.ts`

**Step 1: Write x-utils.ts**

Model after `src/tools/slack-utils.ts`:

```typescript
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
 * X wraps tweets in layers: data.tweet_results.result or data.tweetResult.result
 */
export function extractTweet(entry: Record<string, unknown>): Record<string, unknown> | null {
  // Navigate nested structure: entry -> content -> itemContent -> tweet_results -> result
  const content = entry.content as Record<string, unknown> | undefined;
  const itemContent = (content?.itemContent ?? content?.tweetResult) as Record<string, unknown> | undefined;
  const tweetResults = (itemContent?.tweet_results ?? itemContent) as Record<string, unknown> | undefined;
  const result = tweetResults?.result as Record<string, unknown> | undefined;

  if (!result) return null;

  // Handle "TweetWithVisibilityResults" wrapper
  const tweet = (result.__typename === "TweetWithVisibilityResults"
    ? (result.tweet as Record<string, unknown>)
    : result) as Record<string, unknown> | undefined;

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
  // Navigate to the timeline object using the provided path
  let timeline: Record<string, unknown> = data;
  for (const key of timelinePath) {
    timeline = (timeline[key] as Record<string, unknown>) ?? {};
  }

  const instructions = (timeline.instructions as Array<Record<string, unknown>>) ?? [];
  const tweets: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  for (const instruction of instructions) {
    // TimelineAddEntries instruction contains the actual entries
    const entries = (instruction.entries as Array<Record<string, unknown>>) ?? [];
    for (const entry of entries) {
      const entryId = entry.entryId as string;

      if (entryId?.startsWith("tweet-") || entryId?.startsWith("promoted")) {
        const tweet = extractTweet(entry);
        if (tweet) tweets.push(tweet);
      } else if (entryId?.startsWith("cursor-bottom-")) {
        const content = entry.content as Record<string, unknown> | undefined;
        cursor = content?.value as string | undefined;
      }
    }

    // Some timelines use moduleItems
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
  const user = data?.data as Record<string, unknown> | undefined;
  const userResult = (user?.user as Record<string, unknown>)?.result as Record<string, unknown> | undefined;
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
```

**Step 2: Commit**

```bash
git add src/tools/x-utils.ts
git commit -m "feat(x): add x-utils with query IDs and response extraction helpers"
```

---

### Task 3: Create x_auth_setup tool

**Files:**
- Create: `src/tools/x-auth-tool.ts`

**Step 1: Write the auth tool**

Model after `src/tools/slack-auth-tool.ts` but much simpler — X login is always manual (no SSO automation needed):

```typescript
import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { XClientManager, XSession } from "../auth/x-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";
import { jsonResult } from "./x-utils.js";

export function createXAuthTool(manager: XClientManager, _config: PluginConfig) {
  return {
    name: "x_auth_setup",
    label: "X Auth Setup",
    description:
      "Authenticate with X (Twitter) via browser login. Opens a browser window where you log in manually. Captures session cookies for subsequent API calls.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name for multi-account support. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";

      // Check if existing credentials are still valid
      if (manager.hasCredentials(account)) {
        try {
          // Quick validation: try fetching settings (lightweight authenticated endpoint)
          const session = manager.getCredentials(account)!;
          const resp = await fetch("https://api.x.com/1.1/account/settings.json", {
            headers: {
              Authorization:
                "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
              "x-csrf-token": session.ct0,
              Cookie: `auth_token=${session.auth_token}; ct0=${session.ct0}`,
            },
          });
          if (resp.ok) {
            const settings = (await resp.json()) as { screen_name?: string };
            return jsonResult({
              status: "already_authenticated",
              account,
              username: settings.screen_name ?? session.username,
            });
          }
        } catch {
          // Proceed to re-authenticate
        }
      }

      // Launch Playwright for manual login
      const session = await runXLoginFlow();
      manager.setCredentials(account, session);

      return jsonResult({
        status: "authenticated",
        account,
        username: session.username,
        user_id: session.user_id,
      });
    },
  };
}

async function runXLoginFlow(): Promise<XSession> {
  console.log("[x] Launching browser for X login...");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Navigate to X login
  await page.goto("https://x.com/i/flow/login");
  console.log("[x] Please log in to X in the browser window...");

  // Wait for auth_token cookie to appear (indicates successful login)
  let authToken = "";
  let ct0 = "";

  for (let i = 0; i < 300; i++) {
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === "auth_token" && c.value !== "");
    const ct0Cookie = cookies.find((c) => c.name === "ct0" && c.value !== "");

    if (authCookie && ct0Cookie) {
      authToken = authCookie.value;
      ct0 = ct0Cookie.value;
      console.log("[x] Login detected! Capturing session...");
      break;
    }

    await page.waitForTimeout(1000);
  }

  if (!authToken || !ct0) {
    await browser.close();
    throw new Error("X login timed out after 5 minutes. No auth_token cookie found.");
  }

  // Give the page a moment to fully load after login
  await page.waitForTimeout(2000);

  // Re-read ct0 (it may have been refreshed after page load)
  const finalCookies = await context.cookies();
  const finalCt0 = finalCookies.find((c) => c.name === "ct0");
  if (finalCt0) ct0 = finalCt0.value;

  // Try to extract username and user_id from the page
  let username: string | undefined;
  let userId: string | undefined;

  try {
    const settings = await fetch("https://api.x.com/1.1/account/settings.json", {
      headers: {
        Authorization:
          "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
        "x-csrf-token": ct0,
        Cookie: `auth_token=${authToken}; ct0=${ct0}`,
      },
    });
    if (settings.ok) {
      const data = (await settings.json()) as { screen_name?: string };
      username = data.screen_name;
    }
  } catch {
    // Non-fatal
  }

  // Get user_id from the twid cookie
  const twidCookie = finalCookies.find((c) => c.name === "twid");
  if (twidCookie) {
    // twid cookie format: u%3D<user_id>
    const match = decodeURIComponent(twidCookie.value).match(/u=(\d+)/);
    if (match) userId = match[1];
  }

  const cookieDetails = finalCookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
  }));

  await browser.close();
  console.log(`[x] Authenticated as @${username ?? "unknown"} (${userId ?? "unknown"})`);

  return { auth_token: authToken, ct0, username, user_id: userId, cookie_details: cookieDetails };
}
```

**Step 2: Verify it compiles**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/tools/x-auth-tool.ts
git commit -m "feat(x): add x_auth_setup with Playwright browser login"
```

---

### Task 4: Create timeline tools (x_get_timeline, x_get_user_tweets)

**Files:**
- Create: `src/tools/x-timeline.ts`

**Step 1: Write the timeline tools**

```typescript
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
          isForYou ? "home" : "home",
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
        // Resolve user_id from screen_name if needed
        let userId = params.user_id;
        if (!userId && params.screen_name) {
          const userData = (await manager.graphqlGet(
            account,
            "UserByScreenName",
            QUERY_IDS.UserByScreenName,
            { screen_name: params.screen_name, withSafetyModeUserFields: true },
          )) as Record<string, unknown>;
          const user = (userData as any)?.data?.user?.result;
          userId = user?.rest_id;
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
        const { tweets, cursor } = extractTimelineTweets(data, [
          "data",
          "user",
          "result",
          "timeline_v2",
          "timeline",
        ]);

        return jsonResult({ count: tweets.length, tweets, next_cursor: cursor });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/tools/x-timeline.ts
git commit -m "feat(x): add x_get_timeline and x_get_user_tweets tools"
```

---

### Task 5: Create search tool (x_search)

**Files:**
- Create: `src/tools/x-search.ts`

**Step 1: Write the search tool**

```typescript
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
        const data = (await manager.graphqlGet(
          account,
          "SearchTimeline",
          QUERY_IDS.SearchTimeline,
          variables,
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
```

**Step 2: Commit**

```bash
git add src/tools/x-search.ts
git commit -m "feat(x): add x_search tool with full search operator support"
```

---

### Task 6: Create tweet tools (x_post_tweet, x_delete_tweet, x_reply)

**Files:**
- Create: `src/tools/x-tweet.ts`

**Step 1: Write the tweet tools**

```typescript
import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS } from "./x-utils.js";

export function createXPostTweetTool(manager: XClientManager) {
  return {
    name: "x_post_tweet",
    label: "X Post Tweet",
    description: "Post a new tweet on X (Twitter).",
    parameters: Type.Object({
      text: Type.String({ description: "The tweet text. Max 280 characters for standard accounts." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { text: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const variables = {
        tweet_text: params.text,
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
      };

      try {
        const data = (await manager.graphqlPost(
          account,
          "CreateTweet",
          QUERY_IDS.CreateTweet,
          variables,
        )) as Record<string, unknown>;

        const result = (data as any)?.data?.create_tweet?.tweet_results?.result;
        const legacy = result?.legacy;

        return jsonResult({
          status: "posted",
          tweet_id: legacy?.id_str ?? result?.rest_id,
          text: legacy?.full_text ?? params.text,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXDeleteTweetTool(manager: XClientManager) {
  return {
    name: "x_delete_tweet",
    label: "X Delete Tweet",
    description: "Delete one of your tweets on X (Twitter).",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet to delete." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        await manager.graphqlPost(account, "DeleteTweet", QUERY_IDS.DeleteTweet, {
          tweet_id: params.tweet_id,
          dark_request: false,
        });
        return jsonResult({ status: "deleted", tweet_id: params.tweet_id });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXReplyTool(manager: XClientManager) {
  return {
    name: "x_reply",
    label: "X Reply",
    description: "Reply to a tweet on X (Twitter).",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet to reply to." }),
      text: Type.String({ description: "The reply text." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { tweet_id: string; text: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const variables = {
        tweet_text: params.text,
        reply: { in_reply_to_tweet_id: params.tweet_id, exclude_reply_user_ids: [] },
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
      };

      try {
        const data = (await manager.graphqlPost(
          account,
          "CreateTweet",
          QUERY_IDS.CreateTweet,
          variables,
        )) as Record<string, unknown>;

        const result = (data as any)?.data?.create_tweet?.tweet_results?.result;
        const legacy = result?.legacy;

        return jsonResult({
          status: "replied",
          tweet_id: legacy?.id_str ?? result?.rest_id,
          in_reply_to: params.tweet_id,
          text: legacy?.full_text ?? params.text,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/tools/x-tweet.ts
git commit -m "feat(x): add x_post_tweet, x_delete_tweet, x_reply tools"
```

---

### Task 7: Create engagement tools (x_like, x_unlike, x_retweet, x_unretweet)

**Files:**
- Create: `src/tools/x-engagement.ts`

**Step 1: Write the engagement tools**

```typescript
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
    "x_like",
    "X Like",
    "Like a tweet on X (Twitter).",
    "FavoriteTweet",
    QUERY_IDS.FavoriteTweet,
    "tweet_id",
    "liked",
    manager,
  );
}

export function createXUnlikeTool(manager: XClientManager) {
  return createEngagementTool(
    "x_unlike",
    "X Unlike",
    "Unlike a previously liked tweet on X (Twitter).",
    "UnfavoriteTweet",
    QUERY_IDS.UnfavoriteTweet,
    "tweet_id",
    "unliked",
    manager,
  );
}

export function createXRetweetTool(manager: XClientManager) {
  return createEngagementTool(
    "x_retweet",
    "X Retweet",
    "Retweet a tweet on X (Twitter).",
    "CreateRetweet",
    QUERY_IDS.CreateRetweet,
    "tweet_id",
    "retweeted",
    manager,
  );
}

export function createXUnretweetTool(manager: XClientManager) {
  return createEngagementTool(
    "x_unretweet",
    "X Unretweet",
    "Remove a retweet on X (Twitter).",
    "DeleteRetweet",
    QUERY_IDS.DeleteRetweet,
    "source_tweet_id",
    "unretweeted",
    manager,
  );
}
```

**Step 2: Commit**

```bash
git add src/tools/x-engagement.ts
git commit -m "feat(x): add x_like, x_unlike, x_retweet, x_unretweet tools"
```

---

### Task 8: Create user tools (x_get_profile, x_follow, x_unfollow)

**Files:**
- Create: `src/tools/x-users.ts`

**Step 1: Write the user tools**

```typescript
import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS, extractUser } from "./x-utils.js";

export function createXGetProfileTool(manager: XClientManager) {
  return {
    name: "x_get_profile",
    label: "X Get Profile",
    description: "Get a user's profile on X (Twitter) by their @handle.",
    parameters: Type.Object({
      screen_name: Type.String({ description: "The user's @handle (without the @)." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { screen_name: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const data = (await manager.graphqlGet(
          account,
          "UserByScreenName",
          QUERY_IDS.UserByScreenName,
          { screen_name: params.screen_name, withSafetyModeUserFields: true },
        )) as Record<string, unknown>;

        const user = extractUser(data);
        if (!user) return jsonResult({ error: `User @${params.screen_name} not found.` });

        return jsonResult(user);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXFollowTool(manager: XClientManager) {
  return {
    name: "x_follow",
    label: "X Follow",
    description: "Follow a user on X (Twitter). Requires the user's numeric ID (get it via x_get_profile first).",
    parameters: Type.Object({
      user_id: Type.String({ description: "The numeric user ID to follow." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { user_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        // Follow uses v1.1 REST API, not GraphQL
        const session = manager.getCredentials(account)!;
        const body = new URLSearchParams({ user_id: params.user_id });
        const resp = await fetch("https://api.x.com/1.1/friendships/create.json", {
          method: "POST",
          headers: {
            Authorization:
              "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
            "x-csrf-token": session.ct0,
            Cookie: `auth_token=${session.auth_token}; ct0=${session.ct0}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Follow failed: ${resp.status} — ${text.slice(0, 300)}`);
        }

        const data = (await resp.json()) as { screen_name?: string };
        return jsonResult({ status: "followed", user_id: params.user_id, screen_name: data.screen_name });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXUnfollowTool(manager: XClientManager) {
  return {
    name: "x_unfollow",
    label: "X Unfollow",
    description: "Unfollow a user on X (Twitter). Requires the user's numeric ID.",
    parameters: Type.Object({
      user_id: Type.String({ description: "The numeric user ID to unfollow." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { user_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const session = manager.getCredentials(account)!;
        const body = new URLSearchParams({ user_id: params.user_id });
        const resp = await fetch("https://api.x.com/1.1/friendships/destroy.json", {
          method: "POST",
          headers: {
            Authorization:
              "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
            "x-csrf-token": session.ct0,
            Cookie: `auth_token=${session.auth_token}; ct0=${session.ct0}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Unfollow failed: ${resp.status} — ${text.slice(0, 300)}`);
        }

        const data = (await resp.json()) as { screen_name?: string };
        return jsonResult({ status: "unfollowed", user_id: params.user_id, screen_name: data.screen_name });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/tools/x-users.ts
git commit -m "feat(x): add x_get_profile, x_follow, x_unfollow tools"
```

---

### Task 9: Create bookmarks tool (x_get_bookmarks)

**Files:**
- Create: `src/tools/x-bookmarks.ts`

**Step 1: Write the bookmarks tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS, extractTimelineTweets } from "./x-utils.js";

export function createXGetBookmarksTool(manager: XClientManager) {
  return {
    name: "x_get_bookmarks",
    label: "X Get Bookmarks",
    description: "Get your bookmarked tweets on X (Twitter).",
    parameters: Type.Object({
      count: Type.Optional(Type.Number({ description: "Number of bookmarks to fetch. Defaults to 20.", default: 20 })),
      cursor: Type.Optional(Type.String({ description: "Pagination cursor from previous response." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { count?: number; cursor?: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const variables: Record<string, unknown> = {
        count: params.count ?? 20,
        includePromotedContent: false,
      };
      if (params.cursor) variables.cursor = params.cursor;

      try {
        const data = (await manager.graphqlGet(
          account,
          "Bookmarks",
          QUERY_IDS.Bookmarks,
          variables,
        )) as Record<string, unknown>;
        const { tweets, cursor } = extractTimelineTweets(data, [
          "data",
          "bookmark_timeline_v2",
          "timeline",
        ]);

        return jsonResult({ count: tweets.length, tweets, next_cursor: cursor });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/tools/x-bookmarks.ts
git commit -m "feat(x): add x_get_bookmarks tool"
```

---

### Task 10: Wire up in plugin.ts and plugin-config.ts

**Files:**
- Modify: `src/types/plugin-config.ts:28` (add x_tokens_path field before `dispatch_max_concurrency`)
- Modify: `src/plugin.ts:174` (add imports after Vercel imports)
- Modify: `src/plugin.ts:535` (add registration block after Vercel tools, before Nutrition tools)

**Step 1: Add x_tokens_path to PluginConfig**

In `src/types/plugin-config.ts`, add after line 28 (`vercel_token?: string;`):

```typescript
  x_tokens_path?: string;
```

**Step 2: Add imports to plugin.ts**

After the Vercel imports (around line 197), add:

```typescript
import { XClientManager } from "./auth/x-client-manager.js";
import { createXAuthTool } from "./tools/x-auth-tool.js";
import { createXGetTimelineTool, createXGetUserTweetsTool } from "./tools/x-timeline.js";
import { createXSearchTool } from "./tools/x-search.js";
import { createXPostTweetTool, createXDeleteTweetTool, createXReplyTool } from "./tools/x-tweet.js";
import { createXLikeTool, createXUnlikeTool, createXRetweetTool, createXUnretweetTool } from "./tools/x-engagement.js";
import { createXGetProfileTool, createXFollowTool, createXUnfollowTool } from "./tools/x-users.js";
import { createXGetBookmarksTool } from "./tools/x-bookmarks.js";
```

**Step 3: Add registration block to plugin.ts**

After the Vercel registration block (after `reg(createVercelDeleteEnvVarTool(vercelManager));` around line 534), add:

```typescript
  // X (Twitter) tools — register unconditionally
  const xTokensPath =
    config.x_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-x-tokens.json",
    );

  const xManager = new XClientManager(xTokensPath);

  reg(createXAuthTool(xManager, config));
  reg(createXGetTimelineTool(xManager));
  reg(createXGetUserTweetsTool(xManager));
  reg(createXSearchTool(xManager));
  reg(createXPostTweetTool(xManager));
  reg(createXDeleteTweetTool(xManager));
  reg(createXReplyTool(xManager));
  reg(createXLikeTool(xManager));
  reg(createXUnlikeTool(xManager));
  reg(createXRetweetTool(xManager));
  reg(createXUnretweetTool(xManager));
  reg(createXGetProfileTool(xManager));
  reg(createXFollowTool(xManager));
  reg(createXUnfollowTool(xManager));
  reg(createXGetBookmarksTool(xManager));
```

**Step 4: Build to verify everything compiles**

Run: `pnpm build`

**Step 5: Commit**

```bash
git add src/types/plugin-config.ts src/plugin.ts
git commit -m "feat(x): wire up 15 X tools in plugin registration"
```

---

### Task 11: Create skill file

**Files:**
- Create: `skills/x.SKILL.md`

**Step 1: Write the skill file**

```markdown
---
name: x
description: Full read-write X (Twitter) access — browse timelines, search, post/delete tweets, like, retweet, follow/unfollow, and manage bookmarks via browser session auth.
metadata: {"openclaw": {"emoji": "🐦"}}
---

# X (Twitter)

Full read-write access to X (Twitter) using browser session authentication. No developer API key needed — uses your logged-in browser session.

## First-Time Setup

1. Run `x_auth_setup` — a browser window opens to x.com
2. Log in with your X credentials (handles 2FA automatically)
3. The tool captures your session cookies — you're ready to go

## Available Tools

- **x_auth_setup** — authenticate with X via browser login
- **x_get_timeline** — home timeline (Following or For You tab)
- **x_get_user_tweets** — a specific user's tweets
- **x_search** — search tweets with full X search syntax
- **x_post_tweet** — post a new tweet
- **x_delete_tweet** — delete one of your tweets
- **x_reply** — reply to a tweet
- **x_like** / **x_unlike** — like or unlike a tweet
- **x_retweet** / **x_unretweet** — retweet or remove a retweet
- **x_follow** / **x_unfollow** — follow or unfollow a user
- **x_get_profile** — get a user's profile by @handle
- **x_get_bookmarks** — get your bookmarked tweets

## Workflow

1. Authenticate: `x_auth_setup`
2. Browse: `x_get_timeline` or `x_search query="topic"`
3. Interact: `x_like`, `x_retweet`, `x_reply`
4. Post: `x_post_tweet text="Hello world"`
5. Discover: `x_get_profile screen_name="elonmusk"`

## Search Syntax

X search supports these operators:
- `from:username` — tweets from a specific user
- `to:username` — tweets replying to a specific user
- `@username` — tweets mentioning a user
- `#hashtag` — tweets with a hashtag
- `"exact phrase"` — exact text match
- `since:YYYY-MM-DD` / `until:YYYY-MM-DD` — date range
- `filter:links` / `filter:images` / `filter:videos` — media filters
- `min_retweets:N` / `min_faves:N` / `min_replies:N` — engagement thresholds
- `lang:en` — language filter

## Error Handling

- **Session expired**: Call `x_auth_setup` to re-authenticate
- **Rate limited**: Wait a few minutes before retrying
- **User not found**: Verify the @handle is correct
```

**Step 2: Commit**

```bash
git add skills/x.SKILL.md
git commit -m "feat(x): add X skill documentation"
```

---

### Task 12: Update CLAUDE.md kanban

**Files:**
- Modify: `CLAUDE.md` — move X from Planned to Done in the kanban table

**Step 1: Remove X from Planned table and add to Done table**

In the Done table, add a row after Vercel:

```
| X (Twitter) | 15 | `x` | `docs/plans/2026-02-27-x-twitter-design.md` | Browser session auth, GraphQL API |
```

In the Planned table, remove the `| X (Twitter) | #46 | |` row.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: move X (Twitter) to Done in kanban"
```

---

### Task 13: Write integration test

**Files:**
- Create: `tests/integration/x.test.ts`

**Step 1: Write the integration test**

Model after `tests/integration/slack.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { XClientManager } from "../../src/auth/x-client-manager.js";
import { createXAuthTool } from "../../src/tools/x-auth-tool.js";
import { createXGetTimelineTool, createXGetUserTweetsTool } from "../../src/tools/x-timeline.js";
import { createXSearchTool } from "../../src/tools/x-search.js";
import { createXPostTweetTool, createXDeleteTweetTool, createXReplyTool } from "../../src/tools/x-tweet.js";
import { createXLikeTool, createXUnlikeTool, createXRetweetTool, createXUnretweetTool } from "../../src/tools/x-engagement.js";
import { createXGetProfileTool, createXFollowTool, createXUnfollowTool } from "../../src/tools/x-users.js";
import { createXGetBookmarksTool } from "../../src/tools/x-bookmarks.js";

const TOKENS_PATH = process.env.X_TOKENS_PATH ?? `${process.env.HOME}/.openclaw/omniclaw-x-tokens.json`;
const ACCOUNT = "default";

const config = {
  client_secret_path: "",
  x_tokens_path: TOKENS_PATH,
} as any;

describe("X (Twitter) Integration", () => {
  const manager = new XClientManager(TOKENS_PATH);
  const authTool = createXAuthTool(manager, config);
  const timelineTool = createXGetTimelineTool(manager);
  const userTweetsTool = createXGetUserTweetsTool(manager);
  const searchTool = createXSearchTool(manager);
  const postTweetTool = createXPostTweetTool(manager);
  const deleteTweetTool = createXDeleteTweetTool(manager);
  const replyTool = createXReplyTool(manager);
  const likeTool = createXLikeTool(manager);
  const unlikeTool = createXUnlikeTool(manager);
  const retweetTool = createXRetweetTool(manager);
  const unretweetTool = createXUnretweetTool(manager);
  const profileTool = createXGetProfileTool(manager);
  const followTool = createXFollowTool(manager);
  const unfollowTool = createXUnfollowTool(manager);
  const bookmarksTool = createXGetBookmarksTool(manager);

  beforeAll(async () => {
    // Re-authenticate if no valid session exists
    if (manager.hasCredentials(ACCOUNT)) {
      try {
        const result = await authTool.execute("test", { account: ACCOUNT });
        const parsed = JSON.parse(result.content[0].text);
        if (parsed.status === "already_authenticated") return;
      } catch {
        // Fall through to re-auth
      }
    }

    // Launch Playwright for manual login
    console.log("No valid X session — launching browser for login...");
    const result = await authTool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("authenticated");
  }, 360_000);

  describe("Timeline", () => {
    it("should fetch home timeline", async () => {
      const result = await timelineTool.execute("test", { count: 5, account: ACCOUNT });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.tweets).toBeDefined();
      expect(Array.isArray(parsed.tweets)).toBe(true);
    });

    it("should fetch user tweets", async () => {
      const result = await userTweetsTool.execute("test", {
        screen_name: "elonmusk",
        count: 5,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.tweets).toBeDefined();
    });
  });

  describe("Search", () => {
    it("should search tweets", async () => {
      const result = await searchTool.execute("test", {
        query: "from:elonmusk",
        count: 5,
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.tweets).toBeDefined();
    });
  });

  describe("Profile", () => {
    it("should get user profile", async () => {
      const result = await profileTool.execute("test", {
        screen_name: "elonmusk",
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.screen_name).toBe("elonmusk");
      expect(parsed.followers_count).toBeGreaterThan(0);
    });
  });

  describe("Bookmarks", () => {
    it("should fetch bookmarks", async () => {
      const result = await bookmarksTool.execute("test", { count: 5, account: ACCOUNT });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBeUndefined();
      expect(parsed.tweets).toBeDefined();
    });
  });

  // Write tests — opt-in via RUN_WRITE_TESTS=1
  const writeDescribe = process.env.RUN_WRITE_TESTS ? describe : describe.skip;

  writeDescribe("Write Operations", () => {
    let postedTweetId: string;

    it("should post a tweet", async () => {
      const text = `Integration test tweet — ${new Date().toISOString()} — please ignore`;
      const result = await postTweetTool.execute("test", { text, account: ACCOUNT });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("posted");
      expect(parsed.tweet_id).toBeDefined();
      postedTweetId = parsed.tweet_id;
    });

    it("should like and unlike the posted tweet", async () => {
      expect(postedTweetId).toBeDefined();

      const likeResult = await likeTool.execute("test", { tweet_id: postedTweetId, account: ACCOUNT });
      expect(JSON.parse(likeResult.content[0].text).status).toBe("liked");

      const unlikeResult = await unlikeTool.execute("test", { tweet_id: postedTweetId, account: ACCOUNT });
      expect(JSON.parse(unlikeResult.content[0].text).status).toBe("unliked");
    });

    it("should retweet and unretweet", async () => {
      expect(postedTweetId).toBeDefined();

      const rtResult = await retweetTool.execute("test", { tweet_id: postedTweetId, account: ACCOUNT });
      expect(JSON.parse(rtResult.content[0].text).status).toBe("retweeted");

      const unrtResult = await unretweetTool.execute("test", { tweet_id: postedTweetId, account: ACCOUNT });
      expect(JSON.parse(unrtResult.content[0].text).status).toBe("unretweeted");
    });

    it("should reply to the posted tweet", async () => {
      expect(postedTweetId).toBeDefined();

      const result = await replyTool.execute("test", {
        tweet_id: postedTweetId,
        text: "Test reply — please ignore",
        account: ACCOUNT,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("replied");
      expect(parsed.in_reply_to).toBe(postedTweetId);
    });

    it("should delete the posted tweet", async () => {
      expect(postedTweetId).toBeDefined();

      const result = await deleteTweetTool.execute("test", { tweet_id: postedTweetId, account: ACCOUNT });
      expect(JSON.parse(result.content[0].text).status).toBe("deleted");
    });
  });
});
```

**Step 2: Run the read-only tests**

Run: `pnpm vitest run tests/integration/x.test.ts`

Expected: All read-only tests pass (Timeline, Search, Profile, Bookmarks). Write tests are skipped unless `RUN_WRITE_TESTS=1`.

**Step 3: Commit**

```bash
git add tests/integration/x.test.ts
git commit -m "test(x): add integration tests for all X tools"
```

---

### Task 14: Build and verify

**Step 1: Full build**

Run: `pnpm build`

Expected: Clean compile, no errors.

**Step 2: Run integration tests**

Run: `pnpm vitest run tests/integration/x.test.ts`

Expected: All tests pass. Fix any issues discovered.

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(x): address integration test issues"
```
