import type { SessionStore, SessionData } from "./session-store.js";
import { generateTransactionId } from "./x-transaction-id.js";

/**
 * X (Twitter) uses a constant bearer token for all authenticated web requests,
 * plus session cookies (auth_token, ct0) for user identity.
 * The ct0 cookie serves as the CSRF token and rotates on responses.
 */
const BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

export class XSessionClient {
  private session: SessionData | null = null;

  constructor(
    private sessionStore: SessionStore,
    private account: string = "default",
    private baseUrl: string = "https://x.com",
  ) {
    this.session = sessionStore.get(account) ?? null;
  }

  isAuthenticated(): boolean {
    return this.session !== null && !!this.session.cookies["auth_token"];
  }

  reload(account?: string): void {
    this.session = this.sessionStore.get(account ?? this.account) ?? null;
  }

  /**
   * Extract user ID from the twid cookie (format: "u=1234567890").
   */
  getUserId(): string | undefined {
    const twid = this.session?.cookies["twid"];
    if (!twid) return undefined;
    const match = twid.replace(/"/g, "").match(/u=(\d+)/);
    return match?.[1];
  }

  /**
   * Update the ct0 CSRF token if the response rotates it.
   */
  private updateCsrfFromResponse(res: Response): void {
    if (!this.session) return;

    const setCookieHeader = res.headers.get("set-cookie");
    if (!setCookieHeader) return;

    const match = setCookieHeader.match(/ct0=([^;]+)/);
    if (match && match[1] !== this.session.cookies["ct0"]) {
      this.session.cookies["ct0"] = match[1];
      this.session.csrfToken = match[1];
      this.sessionStore.set(this.account, this.session);
    }
  }

  async request<T = unknown>(opts: {
    method?: string;
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  }): Promise<T> {
    if (!this.session) throw new Error("not_authenticated");

    const cookieHeader = Object.entries(this.session.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const headers: Record<string, string> = {
      Cookie: cookieHeader,
      "User-Agent": this.session.userAgent,
      Authorization: `Bearer ${BEARER_TOKEN}`,
      "X-Csrf-Token": this.session.csrfToken ?? this.session.cookies["ct0"] ?? "",
      "X-Twitter-Active-User": "yes",
      "X-Twitter-Auth-Type": "OAuth2Session",
      "X-Twitter-Client-Language": "en",
      Referer: "https://x.com/",
      Origin: "https://x.com",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      ...opts.headers,
    };

    if (opts.body) {
      headers["Content-Type"] = "application/json";
    }

    let url = `${this.baseUrl}${opts.path}`;
    if (opts.params) {
      const qs = new URLSearchParams(opts.params).toString();
      url += (url.includes("?") ? "&" : "?") + qs;
    }

    // Add x-client-transaction-id for POST mutations (required by X's anti-automation)
    const method = opts.method ?? "GET";
    if (method === "POST") {
      const txId = await generateTransactionId(method, opts.path);
      if (txId) {
        headers["X-Client-Transaction-Id"] = txId;
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    // Update CSRF token from response before checking status
    this.updateCsrfFromResponse(res);

    if (res.status === 401 || res.status === 403) {
      throw new Error("session_expired");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`x_api_error: ${res.status} ${text.slice(0, 200)}`);
      (err as Error & { status: number }).status = res.status;
      throw err;
    }

    return res.json() as Promise<T>;
  }

  /**
   * Make a GraphQL request to X's internal API.
   * X uses POST for mutations and GET for queries.
   */
  async graphql<T = unknown>(opts: {
    queryId: string;
    operationName: string;
    variables: Record<string, unknown>;
    features?: Record<string, boolean>;
    method?: "GET" | "POST";
  }): Promise<T> {
    const features = opts.features ?? DEFAULT_FEATURES;
    const method = opts.method ?? "POST";

    if (method === "GET") {
      return this.request<T>({
        method: "GET",
        path: `/i/api/graphql/${opts.queryId}/${opts.operationName}`,
        params: {
          variables: JSON.stringify(opts.variables),
          features: JSON.stringify(features),
        },
      });
    }

    return this.request<T>({
      method: "POST",
      path: `/i/api/graphql/${opts.queryId}/${opts.operationName}`,
      body: {
        variables: opts.variables,
        features,
        queryId: opts.queryId,
      },
    });
  }

  /**
   * Make a v1.1 REST API request.
   */
  async v1<T = unknown>(opts: {
    method?: string;
    path: string;
    body?: unknown;
    params?: Record<string, string>;
  }): Promise<T> {
    return this.request<T>({
      method: opts.method ?? "GET",
      path: `/i/api/1.1${opts.path}`,
      body: opts.body,
      params: opts.params,
    });
  }

  /**
   * Make a v2 REST API request.
   */
  async v2<T = unknown>(opts: {
    method?: string;
    path: string;
    body?: unknown;
    params?: Record<string, string>;
  }): Promise<T> {
    return this.request<T>({
      method: opts.method ?? "GET",
      path: `/i/api/2${opts.path}`,
      body: opts.body,
      params: opts.params,
    });
  }
}

/**
 * Default feature flags sent with most GraphQL requests.
 * These are commonly required by X's GraphQL endpoints.
 */
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
