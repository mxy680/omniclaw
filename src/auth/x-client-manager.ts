import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface XSession {
  auth_token: string;
  ct0: string;
  username?: string;
  user_id?: string;
  cookie_details?: Record<string, string>;
}

interface XSessionFile {
  [account: string]: XSession;
}

const GRAPHQL_BASE = "https://x.com/i/api/graphql";

// Public bearer token used by the X web client — same across all users.
export const X_BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

// Standard feature flags expected by the X GraphQL API.
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
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as XSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: XSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
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
    const session = this.getCredentials(account);
    return session !== null && session.auth_token !== "" && session.ct0 !== "";
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  /**
   * Builds the headers required for authenticated X GraphQL requests.
   *
   * X uses a dual-token scheme: a static public bearer token for Authorization,
   * plus the per-session `ct0` CSRF token in both the `x-csrf-token` header and
   * the Cookie header alongside `auth_token`.
   */
  private buildHeaders(session: XSession): Record<string, string> {
    const cookieParts: string[] = [
      `auth_token=${session.auth_token}`,
      `ct0=${session.ct0}`,
    ];

    if (session.cookie_details) {
      for (const [key, value] of Object.entries(session.cookie_details)) {
        // Avoid duplicating the primary cookies already added above.
        if (key !== "auth_token" && key !== "ct0") {
          cookieParts.push(`${key}=${value}`);
        }
      }
    }

    return {
      Authorization: `Bearer ${X_BEARER_TOKEN}`,
      "x-csrf-token": session.ct0,
      Cookie: cookieParts.join("; "),
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-client-language": "en",
    };
  }

  /**
   * Handles the raw fetch Response, mapping status codes to typed errors.
   */
  private async handleResponse(resp: Response): Promise<unknown> {
    if (resp.status === 429) {
      const retryAfter = resp.headers.get("Retry-After") ?? "unknown";
      throw new Error(`X API rate limit exceeded. Retry after ${retryAfter}s.`);
    }
    if (resp.status === 401) {
      throw new Error(
        "X session expired or invalid. Call x_auth_setup to re-authenticate.",
      );
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `X API HTTP error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      );
    }
    return resp.json();
  }

  /**
   * Makes a GET request to the X GraphQL API.
   *
   * The query variables and features are serialised as JSON query-string
   * parameters, which is the format X's web client uses.
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

    const mergedFeatures = { ...DEFAULT_FEATURES, ...(features ?? {}) };

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(mergedFeatures),
    });

    const url = `${GRAPHQL_BASE}/${queryId}/${operationName}?${params.toString()}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: this.buildHeaders(session),
    });

    return this.handleResponse(resp);
  }

  /**
   * Makes a POST request to the X GraphQL API.
   *
   * The body is a JSON object containing `variables` and `features`.
   * X's GraphQL mutations (e.g., CreateTweet, DeleteTweet) use this shape.
   */
  async graphqlPost(
    account: string,
    operationName: string,
    queryId: string,
    variables: Record<string, unknown>,
    features?: Record<string, boolean>,
    fieldToggles?: Record<string, boolean>,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const mergedFeatures = { ...DEFAULT_FEATURES, ...(features ?? {}) };

    const url = `${GRAPHQL_BASE}/${queryId}/${operationName}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = { variables, features: mergedFeatures };
    if (fieldToggles) body.fieldToggles = fieldToggles;

    const resp = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(session),
      body: JSON.stringify(body),
    });

    return this.handleResponse(resp);
  }
}
