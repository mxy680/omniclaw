import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface TikTokSession {
  sessionid: string;
  tt_csrf_token: string;
  msToken: string;
  tt_webid_v2: string;
  all_cookies: Record<string, string>;
  cookie_details: Array<{ name: string; value: string; domain: string; path: string }>;
}

interface TikTokSessionFile {
  [account: string]: TikTokSession;
}

/**
 * TikTok client manager.
 *
 * TikTok's API requires request signing (X-Bogus) that only their frontend JS
 * generates. Raw fetch() calls return empty 200s or 403s. To work around this,
 * we use system Chrome (`channel: "chrome"`) and either:
 *   1. Parse `__UNIVERSAL_DATA_FOR_REHYDRATION__` from the page HTML
 *   2. Intercept API responses that TikTok's own JS makes
 *   3. Scrape structured data from the rendered DOM
 */
export class TikTokClientManager {
  constructor(private tokensPath: string) {}

  // ---------------------------------------------------------------------------
  // Session persistence
  // ---------------------------------------------------------------------------

  private load(): TikTokSessionFile {
    if (!existsSync(this.tokensPath)) return {};
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as TikTokSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: TikTokSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: TikTokSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): TikTokSession | null {
    return this.load()[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const session = this.getCredentials(account);
    return session !== null && session.sessionid !== "";
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  // ---------------------------------------------------------------------------
  // Browser helpers
  // ---------------------------------------------------------------------------

  private requireSession(account: string): TikTokSession {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);
    return session;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async openPage(session: TikTokSession): Promise<{ browser: any; page: any }> {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: false, channel: "chrome" });
    const context = await browser.newContext();
    const cookieObjects = session.cookie_details.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || ".tiktok.com",
      path: c.path || "/",
    }));
    if (cookieObjects.length > 0) await context.addCookies(cookieObjects);
    const page = await context.newPage();
    return { browser, page };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async parseRehydration(page: any, scopeKey: string): Promise<unknown> {
    return page.evaluate((key: string) => {
      const el = document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__");
      if (!el) return null;
      try {
        const data = JSON.parse(el.textContent || "{}");
        return data["__DEFAULT_SCOPE__"]?.[key] ?? null;
      } catch {
        return null;
      }
    }, scopeKey);
  }

  /**
   * Navigate to a page and wait for an API response matching `apiPattern`.
   * Returns the parsed JSON body of the first matching response.
   */
  private async interceptApiResponse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page: any,
    pageUrl: string,
    apiPattern: string,
    options?: { scroll?: boolean; timeout?: number },
  ): Promise<unknown> {
    const timeout = options?.timeout ?? 15000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`TikTok API response timeout waiting for ${apiPattern}`)),
        timeout,
      );

      page.on("response", async (response: { url(): string; json(): Promise<unknown> }) => {
        if (response.url().includes(apiPattern)) {
          try {
            const body = await response.json();
            clearTimeout(timer);
            resolve(body);
          } catch {
            /* non-JSON or empty — keep waiting */
          }
        }
      });

      page
        .goto(pageUrl, { waitUntil: "networkidle", timeout: 15000 })
        .catch(() => {})
        .then(async () => {
          if (options?.scroll) {
            // Scroll multiple times to trigger lazy-loading (e.g. comments)
            for (let i = 0; i < 3; i++) {
              await page.evaluate(() => window.scrollBy(0, 800));
              await page.waitForTimeout(1500);
            }
          }
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Public data methods
  // ---------------------------------------------------------------------------

  /**
   * Get a user's profile. Pass "me" for the authenticated user.
   * Uses rehydration data from the profile page.
   */
  async getUserDetail(
    account: string,
    username: string,
  ): Promise<{ userInfo?: { user?: Record<string, unknown>; stats?: Record<string, unknown> } }> {
    const session = this.requireSession(account);
    const pageUrl =
      username === "me"
        ? "https://www.tiktok.com/profile"
        : `https://www.tiktok.com/@${username.replace(/^@/, "")}`;

    const { browser, page } = await this.openPage(session);
    try {
      await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const data = await this.parseRehydration(page, "webapp.user-detail");
      if (!data) {
        throw new Error(
          "TikTok session expired or user not found. Call tiktok_auth_setup again.",
        );
      }
      return data as { userInfo?: { user?: Record<string, unknown>; stats?: Record<string, unknown> } };
    } finally {
      await browser.close();
    }
  }

  /**
   * Get videos from the For You feed.
   * Intercepts TikTok's recommend API response.
   */
  async getFeed(
    account: string,
  ): Promise<{ itemList?: Array<Record<string, unknown>> }> {
    const session = this.requireSession(account);
    const { browser, page } = await this.openPage(session);
    try {
      const data = await this.interceptApiResponse(
        page,
        "https://www.tiktok.com/foryou",
        "/api/recommend/item_list",
      );
      return (data ?? { itemList: [] }) as { itemList?: Array<Record<string, unknown>> };
    } finally {
      await browser.close();
    }
  }

  /**
   * Get a user's videos by scraping video links from their profile page.
   * The post/item_list API returns empty even from TikTok's own frontend,
   * so we extract video metadata from the DOM and oembed API.
   */
  async getUserVideos(
    account: string,
    username: string,
    count?: number,
  ): Promise<{ itemList: Array<Record<string, unknown>> }> {
    const session = this.requireSession(account);
    const maxCount = Math.min(count ?? 12, 30);
    const { browser, page } = await this.openPage(session);
    try {
      await page
        .goto(`https://www.tiktok.com/@${username.replace(/^@/, "")}`, {
          waitUntil: "networkidle",
          timeout: 15000,
        })
        .catch(() => {});
      await page.waitForTimeout(3000);

      // Extract video IDs and basic metadata from the profile page DOM
      const videos = await page.evaluate((max: number) => {
        const results: Array<Record<string, unknown>> = [];
        const links = Array.from(document.querySelectorAll('a[href*="/video/"]'));
        const seen = new Set<string>();
        for (let i = 0; i < links.length && results.length < max; i++) {
          const href = (links[i] as HTMLAnchorElement).href;
          const match = href.match(/\/video\/(\d+)/);
          if (!match || seen.has(match[1])) continue;
          seen.add(match[1]);

          const card = links[i].closest("[class]");
          const desc =
            card?.querySelector('[class*="desc"], [class*="title"], [data-e2e*="desc"]')
              ?.textContent ?? "";
          const views =
            card?.querySelector('[class*="count"], [data-e2e*="views"]')?.textContent ?? "";

          results.push({
            id: match[1],
            url: href,
            desc: desc || null,
            viewsText: views || null,
          });
        }
        return results;
      }, maxCount);

      // Enrich with oembed data for each video (no auth needed, fast)
      const enriched: Array<Record<string, unknown>> = [];
      for (const video of videos) {
        try {
          const oembedData = await page.evaluate(async (videoUrl: string) => {
            const resp = await fetch(
              `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
            );
            if (!resp.ok) return null;
            return resp.json();
          }, video.url as string);

          enriched.push({
            id: video.id,
            desc: (oembedData as Record<string, unknown>)?.title ?? video.desc,
            author: {
              uniqueId: (oembedData as Record<string, unknown>)?.author_name,
              url: (oembedData as Record<string, unknown>)?.author_url,
            },
            thumbnail: (oembedData as Record<string, unknown>)?.thumbnail_url,
            thumbnailWidth: (oembedData as Record<string, unknown>)?.thumbnail_width,
            thumbnailHeight: (oembedData as Record<string, unknown>)?.thumbnail_height,
          });
        } catch {
          enriched.push(video);
        }
      }

      return { itemList: enriched };
    } finally {
      await browser.close();
    }
  }

  /**
   * Search for videos by keyword.
   * Intercepts TikTok's search API response.
   */
  async searchVideos(
    account: string,
    query: string,
  ): Promise<{ data?: Array<Record<string, unknown>> }> {
    const session = this.requireSession(account);
    const { browser, page } = await this.openPage(session);
    try {
      const data = await this.interceptApiResponse(
        page,
        `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
        "/api/search/general/full",
      );
      return (data ?? { data: [] }) as { data?: Array<Record<string, unknown>> };
    } finally {
      await browser.close();
    }
  }

  /**
   * Search for users by keyword.
   * Intercepts TikTok's user search API response.
   */
  async searchUsers(
    account: string,
    query: string,
  ): Promise<{ user_list?: Array<Record<string, unknown>> }> {
    const session = this.requireSession(account);
    const { browser, page } = await this.openPage(session);
    try {
      const data = await this.interceptApiResponse(
        page,
        `https://www.tiktok.com/search/user?q=${encodeURIComponent(query)}`,
        "/api/search/user",
      );
      return (data ?? { user_list: [] }) as { user_list?: Array<Record<string, unknown>> };
    } finally {
      await browser.close();
    }
  }

  /**
   * Get video details by video ID or URL.
   * Navigates to the video page and intercepts the item/detail API response.
   */
  async getVideoDetail(
    account: string,
    videoId: string,
  ): Promise<{ itemInfo?: { itemStruct?: Record<string, unknown> } }> {
    const session = this.requireSession(account);

    // Resolve video URL — need author username for TikTok URLs
    let videoUrl: string;
    if (videoId.includes("tiktok.com")) {
      // Already a full URL
      videoUrl = videoId;
    } else {
      // Resolve via oembed (no auth needed)
      const oembedResp = await fetch(
        `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@_/video/${videoId}`,
      );
      if (oembedResp.ok) {
        const oembed = (await oembedResp.json()) as { author_name?: string };
        videoUrl = `https://www.tiktok.com/@${oembed.author_name ?? "_"}/video/${videoId}`;
      } else {
        // Try navigating to the foryou page and clicking a link
        throw new Error(
          `Cannot resolve video ${videoId}. Provide a full TikTok video URL instead.`,
        );
      }
    }

    const { browser, page } = await this.openPage(session);
    try {
      // Navigate to video page and parse rehydration for video detail
      await page
        .goto(videoUrl, { waitUntil: "networkidle", timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(2000);

      const data = await this.parseRehydration(page, "webapp.video-detail");
      if (data) return data as { itemInfo?: { itemStruct?: Record<string, unknown> } };

      // Fallback: intercept item/detail API (might fire on navigation)
      throw new Error("Video not found in page data.");
    } finally {
      await browser.close();
    }
  }

  /**
   * Get comments on a video.
   * Navigates to the video page, clicks the comment icon, and scrapes
   * rendered comments from the DOM (TikTok doesn't expose a REST API for this).
   */
  async getVideoComments(
    account: string,
    videoId: string,
  ): Promise<{ comments: Array<Record<string, unknown>> }> {
    const session = this.requireSession(account);

    // Resolve video URL
    let videoUrl: string;
    if (videoId.includes("tiktok.com")) {
      videoUrl = videoId;
    } else {
      const oembedResp = await fetch(
        `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@_/video/${videoId}`,
      );
      if (oembedResp.ok) {
        const oembed = (await oembedResp.json()) as { author_name?: string };
        videoUrl = `https://www.tiktok.com/@${oembed.author_name ?? "_"}/video/${videoId}`;
      } else {
        throw new Error(
          `Cannot resolve video ${videoId}. Provide a full TikTok video URL instead.`,
        );
      }
    }

    const { browser, page } = await this.openPage(session);
    try {
      await page
        .goto(videoUrl, { waitUntil: "networkidle", timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(3000);

      // Click the comment icon to open/load comments
      try {
        await page.click('[data-e2e="comment-icon"]', { timeout: 5000 });
      } catch {
        try {
          await page.click('[data-e2e="comments"]', { timeout: 3000 });
        } catch {
          // Comments may already be visible
        }
      }
      await page.waitForTimeout(3000);

      // Scrape comments from the rendered DOM
      const comments = await page.evaluate(() => {
        const results: Array<Record<string, unknown>> = [];
        // Try multiple selectors for comment containers
        const containers = Array.from(
          document.querySelectorAll(
            '[class*="CommentItem"], [class*="comment-content"], [class*="DivCommentItemContainer"]',
          ),
        );
        for (let i = 0; i < containers.length; i++) {
          const el = containers[i];
          // Extract username — look for link elements or specific data-e2e
          const userEl =
            el.querySelector('[data-e2e="comment-username-1"]') ??
            el.querySelector('a[href*="/@"]') ??
            el.querySelector("a span");
          const username = userEl?.textContent?.trim() ?? "";

          // Extract comment text — look for paragraph elements
          const textEl =
            el.querySelector('[data-e2e="comment-level-1"] p') ??
            el.querySelector("p") ??
            el.querySelector("span:not(:first-child)");
          let text = textEl?.textContent?.trim() ?? "";
          // If text is empty, try the whole container minus the username
          if (!text) {
            text = (el.textContent ?? "").replace(username, "").trim().slice(0, 500);
          }

          // Extract like count
          const likeEl =
            el.querySelector('[data-e2e="comment-like-count"]') ??
            el.querySelector('[class*="like-count"], [class*="LikeCount"]');
          const diggCount = likeEl?.textContent?.trim() ?? "";

          if (username || text) {
            results.push({
              user: { uniqueId: username },
              text,
              digg_count: diggCount,
            });
          }
        }
        return results;
      });

      return { comments };
    } finally {
      await browser.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Legacy API (deprecated — kept for auth tool validation)
  // ---------------------------------------------------------------------------

  /**
   * @deprecated Use specific methods (getUserDetail, getFeed, etc.) instead.
   * Raw API calls no longer work due to TikTok's request signing requirements.
   */
  async get(
    account: string,
    url: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    // Route to the appropriate new method based on URL
    const apiPath = url.replace(/\?.*$/, "");

    if (apiPath.includes("/api/user/detail")) {
      const urlObj = new URL(url);
      const uniqueId = urlObj.searchParams.get("uniqueId") ?? params?.uniqueId ?? "me";
      return this.getUserDetail(account, uniqueId);
    }
    if (apiPath.includes("/api/recommend/item_list")) {
      return this.getFeed(account);
    }
    if (apiPath.includes("/api/search/general/full")) {
      return this.searchVideos(account, params?.keyword ?? "");
    }
    if (apiPath.includes("/api/search/user/full")) {
      return this.searchUsers(account, params?.keyword ?? "");
    }
    if (apiPath.includes("/api/item/detail")) {
      return this.getVideoDetail(account, params?.itemId ?? "");
    }
    if (apiPath.includes("/api/comment/list")) {
      return this.getVideoComments(account, params?.aweme_id ?? "");
    }

    throw new Error(
      `Unsupported TikTok API endpoint: ${apiPath}. TikTok requires request signing — use the specific client methods instead.`,
    );
  }
}
