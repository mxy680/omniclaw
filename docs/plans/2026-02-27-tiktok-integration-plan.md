# TikTok Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a consumption-focused TikTok integration with 10 tools using Playwright browser-session authentication.

**Architecture:** Mirrors the Instagram integration exactly. `TikTokClientManager` handles session storage and Playwright-context HTTP. Auth tool launches a visible browser for login, captures `sessionid` cookie. Data tools call TikTok's internal web API via `page.evaluate()` inside a headless browser to bypass anti-bot protections.

**Tech Stack:** TypeScript, Playwright, @sinclair/typebox, vitest

**Design doc:** `docs/plans/2026-02-27-tiktok-integration-design.md`

---

### Task 1: TikTok Client Manager

**Files:**
- Create: `src/auth/tiktok-client-manager.ts`

**Step 1: Create the client manager**

This mirrors `src/auth/instagram-client-manager.ts` exactly, adapted for TikTok's cookies and API base URL.

```typescript
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

export class TikTokClientManager {
  constructor(private tokensPath: string) {}

  private load(): TikTokSessionFile {
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as TikTokSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: TikTokSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: TikTokSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): TikTokSession | null {
    const data = this.load();
    return data[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const session = this.getCredentials(account);
    return session !== null && session.sessionid !== "";
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  private buildCookieString(session: TikTokSession): string {
    if (Object.keys(session.all_cookies).length > 0) {
      return Object.entries(session.all_cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    }
    return `sessionid=${session.sessionid}; tt_csrf_token=${session.tt_csrf_token}`;
  }

  async get(
    account: string,
    url: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const searchParams = new URLSearchParams(params ?? {});
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }

    const cookieStr = this.buildCookieString(session);
    const headers: Record<string, string> = {
      Cookie: cookieStr,
      Accept: "application/json, text/plain, */*",
    };

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();

      const cookieObjects = session.cookie_details.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || ".tiktok.com",
        path: c.path || "/",
      }));
      if (cookieObjects.length > 0) {
        await context.addCookies(cookieObjects);
      }

      const page = await context.newPage();
      await page.goto("https://www.tiktok.com", { waitUntil: "domcontentloaded" });

      const result = await page.evaluate(
        async ({ fetchUrl, fetchHeaders }) => {
          const resp = await fetch(fetchUrl, {
            method: "GET",
            headers: fetchHeaders,
            credentials: "include",
          });
          const body = await resp.text();
          const setCookieHeader = resp.headers.get("set-cookie") ?? "";
          return {
            status: resp.status,
            statusText: resp.statusText,
            body,
            setCookie: setCookieHeader,
          };
        },
        { fetchUrl: url, fetchHeaders: headers },
      );

      await browser.close();

      if (result.status === 401 || result.status === 403) {
        throw new Error("TikTok session expired. Call tiktok_auth_setup again.");
      }
      if (result.status === 429) {
        throw new Error("TikTok API rate limit exceeded. Please wait before retrying.");
      }
      if (result.status >= 400) {
        throw new Error(`TikTok API error: ${result.status} ${result.statusText}`);
      }

      if (result.setCookie) {
        this.updateCookiesFromHeader(account, result.setCookie);
      }

      return JSON.parse(result.body);
    } catch (err) {
      await browser.close().catch(() => {});
      throw err;
    }
  }

  private updateCookiesFromHeader(account: string, setCookieHeader: string): void {
    const session = this.getCredentials(account);
    if (!session) return;

    const cookies = setCookieHeader.split(/,(?=\s*\w+=)/);
    let updated = false;
    for (const cookie of cookies) {
      const match = cookie.trim().match(/^([^=]+)=([^;]*)/);
      if (match) {
        const [, name, value] = match;
        session.all_cookies[name.trim()] = value.trim();
        updated = true;
      }
    }

    if (updated) {
      this.setCredentials(account, session);
    }
  }
}
```

Note: Unlike Instagram, TikTok's client manager takes full URLs (not path suffixes) because TikTok's API endpoints use various URL patterns. The `get()` method accepts a full `https://www.tiktok.com/api/...` URL.

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors from this file

**Step 3: Commit**

```bash
git add src/auth/tiktok-client-manager.ts
git commit -m "feat(tiktok): add TikTok client manager with Playwright-context HTTP"
```

---

### Task 2: TikTok Auth Tool

**Files:**
- Create: `src/tools/tiktok-auth-tool.ts`

**Step 1: Create the auth tool**

Mirrors `src/tools/instagram-auth-tool.ts`. Polls for `sessionid` cookie after TikTok login.

```typescript
import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { TikTokClientManager, TikTokSession } from "../auth/tiktok-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokAuthTool(
  tiktokManager: TikTokClientManager,
  config: PluginConfig,
): any {
  return {
    name: "tiktok_auth_setup",
    label: "TikTok Auth Setup",
    description:
      "Authenticate with TikTok. Opens a browser for login, captures session cookies, then validates the session. The tool reads tiktok_username and tiktok_password from the plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      username: Type.Optional(
        Type.String({
          description: "Override for TikTok username/email. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for TikTok password. Usually omitted — uses pre-configured value.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'personal'). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { username?: string; password?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const resolvedUsername = params.username ?? config.tiktok_username;
      const resolvedPassword = params.password ?? config.tiktok_password;

      // Check if we already have a valid session
      if (tiktokManager.hasCredentials(account)) {
        try {
          const data = (await tiktokManager.get(
            account,
            "https://www.tiktok.com/api/user/detail/?uniqueId=me",
          )) as { userInfo?: { user?: { uniqueId?: string; nickname?: string } } };
          const user = data?.userInfo?.user;
          if (user?.uniqueId) {
            return jsonResult({
              status: "already_authenticated",
              account,
              username: user.uniqueId,
              nickname: user.nickname ?? "unknown",
              message: "Existing session is still valid. No re-authentication needed.",
            });
          }
        } catch {
          // Session invalid — proceed with re-auth
        }
      }

      try {
        const session = await runTikTokLoginFlow(resolvedUsername, resolvedPassword);

        tiktokManager.setCredentials(account, session);

        try {
          const data = (await tiktokManager.get(
            account,
            "https://www.tiktok.com/api/user/detail/?uniqueId=me",
          )) as { userInfo?: { user?: { uniqueId?: string; nickname?: string } } };
          const user = data?.userInfo?.user;

          return jsonResult({
            status: "authenticated",
            account,
            username: user?.uniqueId ?? "unknown",
            nickname: user?.nickname ?? "unknown",
          });
        } catch {
          return jsonResult({
            status: "authenticated",
            account,
            username: "unknown",
            nickname: "unknown",
            note: "Session saved but profile fetch failed. Tools may still work.",
          });
        }
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. If the user needs to update credentials, direct them to run: openclaw config set plugins.entries.omniclaw.config.tiktok_password "new_password" — never ask them to type passwords in the chat.',
        });
      }
    },
  };
}

async function runTikTokLoginFlow(
  username?: string,
  password?: string,
): Promise<TikTokSession> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("[tiktok] Navigating to TikTok login...");
    await page.goto("https://www.tiktok.com/login/phone-or-email/email", { waitUntil: "networkidle" });

    // Dismiss cookie consent banner
    try {
      const cookieBtn = page.locator(
        'button:has-text("Accept all"), button:has-text("Allow all cookies"), button:has-text("Accept cookies")',
      );
      await cookieBtn.first().click({ timeout: 5000 });
      console.log("[tiktok] Cookie consent dismissed.");
      await page.waitForTimeout(2000);
    } catch {
      // No cookie banner — continue
    }

    // Auto-fill credentials if provided
    if (username && password) {
      console.log("[tiktok] Filling credentials...");
      try {
        await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 30000 });
        const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]').first();

        await usernameInput.click();
        await usernameInput.pressSequentially(username, { delay: 30 });
        await passwordInput.click();
        await passwordInput.pressSequentially(password, { delay: 30 });
        await page.waitForTimeout(500);

        // Click login button (TikTok uses a button, not Enter)
        const loginBtn = page.locator('button[type="submit"], button:has-text("Log in")').first();
        await loginBtn.click();
        console.log("[tiktok] Credentials submitted.");
      } catch (e) {
        console.log(`[tiktok] Login form error: ${e}`);
        console.log(`[tiktok] Current URL: ${page.url()}`);
        console.log("[tiktok] Waiting for manual login instead...");
      }
    } else {
      console.log("[tiktok] No credentials configured — waiting for manual login...");
    }

    // Poll for sessionid cookie (up to 5 minutes)
    console.log("[tiktok] Waiting for login to complete (up to 5 minutes)...");
    let loggedIn = false;

    for (let i = 0; i < 300; i++) {
      const cookies = await context.cookies();
      const sessionCookie = cookies.find((c) => c.name === "sessionid");
      if (sessionCookie && sessionCookie.value) {
        console.log("[tiktok] Login detected — sessionid cookie captured.");
        loggedIn = true;
        break;
      }

      if (i % 30 === 0 && i > 0) {
        console.log(`[tiktok] Still waiting for login... (${i}s, URL: ${page.url().slice(0, 80)})`);
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error("Login timed out after 5 minutes waiting for sessionid cookie.");
    }

    // Capture all cookies
    const finalCookies = await context.cookies();
    const allCookies: Record<string, string> = {};
    const cookieDetails: Array<{ name: string; value: string; domain: string; path: string }> = [];
    for (const c of finalCookies) {
      allCookies[c.name] = c.value;
      cookieDetails.push({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
      });
    }

    const sessionid = allCookies["sessionid"] ?? "";
    const tt_csrf_token = allCookies["tt_csrf_token"] ?? allCookies["csrf_token"] ?? "";
    const msToken = allCookies["msToken"] ?? "";
    const tt_webid_v2 = allCookies["tt_webid_v2"] ?? allCookies["tt_webid"] ?? "";

    await browser.close();

    if (!sessionid) {
      throw new Error("Failed to capture sessionid cookie after login.");
    }

    return {
      sessionid,
      tt_csrf_token,
      msToken,
      tt_webid_v2,
      all_cookies: allCookies,
      cookie_details: cookieDetails,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors from this file

**Step 3: Commit**

```bash
git add src/tools/tiktok-auth-tool.ts
git commit -m "feat(tiktok): add TikTok auth tool with Playwright browser login"
```

---

### Task 3: TikTok Utility Helpers

**Files:**
- Create: `src/tools/tiktok-utils.ts`

**Step 1: Create shared utility functions**

TikTok-specific helpers for formatting video data, timestamps, and user objects.

```typescript
export function formatTimestamp(ts: number | undefined): string | null {
  if (ts == null) return null;
  // TikTok uses seconds
  return new Date(ts * 1000).toISOString();
}

export function truncateText(text: string | undefined | null, max = 500): string | null {
  if (!text) return null;
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export function formatUser(
  user: Record<string, unknown> | undefined | null,
): Record<string, unknown> | null {
  if (!user) return null;
  return {
    uniqueId: user.uniqueId,
    nickname: user.nickname,
    avatarThumb: user.avatarThumb,
    verified: user.verified ?? false,
    id: user.id,
  };
}

export function formatStats(
  stats: Record<string, unknown> | undefined | null,
): Record<string, unknown> | null {
  if (!stats) return null;
  return {
    diggCount: stats.diggCount,
    shareCount: stats.shareCount,
    commentCount: stats.commentCount,
    playCount: stats.playCount,
    collectCount: stats.collectCount,
  };
}

export function formatVideo(item: Record<string, unknown>): Record<string, unknown> {
  const author = item.author as Record<string, unknown> | undefined;
  const stats = item.stats as Record<string, unknown> | undefined;
  const video = item.video as Record<string, unknown> | undefined;
  const music = item.music as Record<string, unknown> | undefined;

  return {
    id: item.id,
    desc: truncateText(item.desc as string | undefined),
    createTime: formatTimestamp(item.createTime as number | undefined),
    duration: video?.duration,
    cover: video?.cover ?? video?.originCover,
    playAddr: video?.playAddr,
    diggCount: stats?.diggCount,
    shareCount: stats?.shareCount,
    commentCount: stats?.commentCount,
    playCount: stats?.playCount,
    collectCount: stats?.collectCount,
    author: formatUser(author),
    music: music
      ? { id: music.id, title: music.title, authorName: music.authorName }
      : null,
  };
}

export function parseTikTokVideoId(input: string): string {
  // Accept full URL or just video ID
  // URLs: https://www.tiktok.com/@user/video/1234567890
  // or: https://vm.tiktok.com/ZMxxxxxx/
  const match = input.match(/\/video\/(\d+)/);
  if (match) return match[1];
  // If it's already a numeric ID
  if (/^\d+$/.test(input)) return input;
  return input;
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/tiktok-utils.ts
git commit -m "feat(tiktok): add TikTok utility helpers for formatting"
```

---

### Task 4: Profile Tools (tiktok_profile + tiktok_get_user)

**Files:**
- Create: `src/tools/tiktok-profile.ts`

**Step 1: Create both profile tools**

```typescript
import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatUser } from "./tiktok-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call tiktok_auth_setup to authenticate with TikTok first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokProfileTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_profile",
    label: "TikTok Profile",
    description:
      "Get the authenticated user's TikTok profile including username, nickname, bio, follower/following counts, and avatar.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        // Fetch own profile — TikTok returns the logged-in user when no uniqueId is specified
        // We'll try the webapp endpoint that returns user info from the session
        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/user/detail/",
        )) as { userInfo?: { user?: Record<string, unknown>; stats?: Record<string, unknown> } };

        const user = data?.userInfo?.user;
        const stats = data?.userInfo?.stats;
        if (!user) {
          return jsonResult({ error: "No profile data found in response." });
        }

        return jsonResult({
          uniqueId: user.uniqueId,
          nickname: user.nickname,
          bio: user.signature,
          avatarUrl: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb,
          verified: user.verified,
          followerCount: stats?.followerCount,
          followingCount: stats?.followingCount,
          heartCount: stats?.heartCount,
          videoCount: stats?.videoCount,
          id: user.id,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokGetUserTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_get_user",
    label: "TikTok Get User",
    description:
      "Get any TikTok user's public profile by username. Returns bio, follower/following counts, video count, and total likes.",
    parameters: Type.Object({
      username: Type.String({
        description: "TikTok username without @ (e.g. 'charlidamelio').",
      }),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { username: string; account?: string }) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const username = params.username.replace(/^@/, "");
        const data = (await tiktokManager.get(
          account,
          `https://www.tiktok.com/api/user/detail/?uniqueId=${encodeURIComponent(username)}`,
        )) as { userInfo?: { user?: Record<string, unknown>; stats?: Record<string, unknown> } };

        const user = data?.userInfo?.user;
        const stats = data?.userInfo?.stats;
        if (!user) {
          return jsonResult({ error: `User "${params.username}" not found.` });
        }

        return jsonResult({
          uniqueId: user.uniqueId,
          nickname: user.nickname,
          bio: user.signature,
          avatarUrl: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb,
          verified: user.verified,
          privateAccount: user.privateAccount,
          followerCount: stats?.followerCount,
          followingCount: stats?.followingCount,
          heartCount: stats?.heartCount,
          videoCount: stats?.videoCount,
          id: user.id,
          secUid: user.secUid,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/tiktok-profile.ts
git commit -m "feat(tiktok): add profile and get-user tools"
```

---

### Task 5: User Videos Tool (tiktok_user_videos)

**Files:**
- Create: `src/tools/tiktok-user-videos.ts`

**Step 1: Create the user videos tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatVideo } from "./tiktok-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call tiktok_auth_setup to authenticate with TikTok first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokUserVideosTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_user_videos",
    label: "TikTok User Videos",
    description:
      "Get recent videos from a specific TikTok user by username. Returns their latest posts with descriptions and engagement metrics.",
    parameters: Type.Object({
      username: Type.String({
        description: "TikTok username without @ (e.g. 'charlidamelio').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of videos to retrieve (default 12, max 30).",
          default: 12,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { username: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const username = params.username.replace(/^@/, "");
        const count = Math.min(params.count ?? 12, 30);

        // First resolve username to secUid
        const userDetail = (await tiktokManager.get(
          account,
          `https://www.tiktok.com/api/user/detail/?uniqueId=${encodeURIComponent(username)}`,
        )) as { userInfo?: { user?: { secUid?: string } } };

        const secUid = userDetail?.userInfo?.user?.secUid;
        if (!secUid) {
          return jsonResult({ error: `Could not resolve user "${username}".` });
        }

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/post/item_list/",
          { secUid, count: String(count), cursor: "0" },
        )) as { itemList?: Array<Record<string, unknown>> };

        const items = data?.itemList ?? [];
        const videos = items.slice(0, count).map(formatVideo);

        return jsonResult({ username, count: videos.length, videos });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/tiktok-user-videos.ts
git commit -m "feat(tiktok): add user videos tool"
```

---

### Task 6: Video Details Tool (tiktok_video_details)

**Files:**
- Create: `src/tools/tiktok-video-details.ts`

**Step 1: Create the video details tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatVideo, parseTikTokVideoId } from "./tiktok-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call tiktok_auth_setup to authenticate with TikTok first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokVideoDetailsTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_video_details",
    label: "TikTok Video Details",
    description:
      "Get full details for a specific TikTok video by URL or video ID. Returns description, engagement metrics, author info, and music.",
    parameters: Type.Object({
      video: Type.String({
        description:
          "TikTok video URL or video ID (e.g. 'https://www.tiktok.com/@user/video/7123456789' or '7123456789').",
      }),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { video: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const videoId = parseTikTokVideoId(params.video);

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/item/detail/",
          { itemId: videoId },
        )) as { itemInfo?: { itemStruct?: Record<string, unknown> } };

        const item = data?.itemInfo?.itemStruct;
        if (!item) {
          return jsonResult({ error: "Video not found." });
        }

        return jsonResult(formatVideo(item));
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/tiktok-video-details.ts
git commit -m "feat(tiktok): add video details tool"
```

---

### Task 7: Feed Tool (tiktok_feed)

**Files:**
- Create: `src/tools/tiktok-feed.ts`

**Step 1: Create the For You feed tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatVideo } from "./tiktok-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call tiktok_auth_setup to authenticate with TikTok first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokFeedTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_feed",
    label: "TikTok Feed",
    description:
      "Get videos from the For You page (personalized recommendations). Returns recent recommended videos with engagement metrics.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of videos to retrieve (default 10, max 30).",
          default: 10,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { count?: number; account?: string }) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 10, 30);

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/recommend/item_list/",
          { count: String(count) },
        )) as { itemList?: Array<Record<string, unknown>> };

        const items = data?.itemList ?? [];
        const videos = items.slice(0, count).map(formatVideo);

        return jsonResult({ count: videos.length, videos });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/tiktok-feed.ts
git commit -m "feat(tiktok): add For You feed tool"
```

---

### Task 8: Search Tools (tiktok_search_videos + tiktok_search_users)

**Files:**
- Create: `src/tools/tiktok-search.ts`

**Step 1: Create both search tools**

```typescript
import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatVideo, formatUser } from "./tiktok-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call tiktok_auth_setup to authenticate with TikTok first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokSearchVideosTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_search_videos",
    label: "TikTok Search Videos",
    description: "Search TikTok for videos matching a keyword query.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (e.g. 'cooking recipes', 'dance trends').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of results (default 12, max 30).",
          default: 12,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 12, 30);

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/search/general/full/",
          { keyword: params.query, offset: "0", count: String(count) },
        )) as { data?: Array<Record<string, unknown>> };

        const rawItems = data?.data ?? [];
        const videos = rawItems
          .filter((item) => item.type === 1) // type 1 = video
          .map((item) => {
            const itemContent = item.item as Record<string, unknown> | undefined;
            return itemContent ? formatVideo(itemContent) : null;
          })
          .filter(Boolean)
          .slice(0, count);

        return jsonResult({ query: params.query, count: videos.length, videos });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokSearchUsersTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_search_users",
    label: "TikTok Search Users",
    description: "Search TikTok for user accounts matching a keyword query.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (e.g. 'gordon ramsay', 'dance').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of results (default 10, max 30).",
          default: 10,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 10, 30);

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/search/user/full/",
          { keyword: params.query, offset: "0", count: String(count) },
        )) as { user_list?: Array<Record<string, unknown>> };

        const rawUsers = data?.user_list ?? [];
        const users = rawUsers.slice(0, count).map((item) => {
          const userInfo = item.user_info as Record<string, unknown> | undefined;
          if (!userInfo) return null;
          return {
            ...formatUser(userInfo),
            signature: userInfo.signature,
            followerCount: userInfo.follower_count ?? (item as Record<string, unknown>).follower_count,
          };
        }).filter(Boolean);

        return jsonResult({ query: params.query, count: users.length, users });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/tiktok-search.ts
git commit -m "feat(tiktok): add search tools for videos and users"
```

---

### Task 9: Trending Tool (tiktok_trending)

**Files:**
- Create: `src/tools/tiktok-trending.ts`

**Step 1: Create the trending/discover tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatVideo } from "./tiktok-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call tiktok_auth_setup to authenticate with TikTok first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokTrendingTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_trending",
    label: "TikTok Trending",
    description:
      "Get trending/popular TikTok videos from the discover page. Returns currently viral content.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of videos to retrieve (default 10, max 30).",
          default: 10,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 10, 30);

        // Try the trending endpoint
        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/recommend/item_list/",
          { count: String(count), pullType: "2" },
        )) as { itemList?: Array<Record<string, unknown>> };

        const items = data?.itemList ?? [];
        const videos = items.slice(0, count).map(formatVideo);

        return jsonResult({ count: videos.length, videos });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/tiktok-trending.ts
git commit -m "feat(tiktok): add trending/discover tool"
```

---

### Task 10: Video Comments Tool (tiktok_video_comments)

**Files:**
- Create: `src/tools/tiktok-video-comments.ts`

**Step 1: Create the comments tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { TikTokClientManager } from "../auth/tiktok-client-manager.js";
import { formatTimestamp, formatUser, parseTikTokVideoId } from "./tiktok-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call tiktok_auth_setup to authenticate with TikTok first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokVideoCommentsTool(tiktokManager: TikTokClientManager): any {
  return {
    name: "tiktok_video_comments",
    label: "TikTok Video Comments",
    description: "Get comments on a specific TikTok video by URL or video ID.",
    parameters: Type.Object({
      video: Type.String({
        description:
          "TikTok video URL or video ID (e.g. 'https://www.tiktok.com/@user/video/7123456789' or '7123456789').",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of comments to retrieve (default 20, max 50).",
          default: 20,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "TikTok account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { video: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!tiktokManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const videoId = parseTikTokVideoId(params.video);
        const count = Math.min(params.count ?? 20, 50);

        const data = (await tiktokManager.get(
          account,
          "https://www.tiktok.com/api/comment/list/",
          { aweme_id: videoId, count: String(count), cursor: "0" },
        )) as { comments?: Array<Record<string, unknown>> };

        const rawComments = data?.comments ?? [];
        const comments = rawComments.slice(0, count).map((c) => ({
          id: c.cid,
          text: c.text,
          createTime: formatTimestamp(c.create_time as number | undefined),
          diggCount: c.digg_count,
          replyCount: c.reply_comment_total,
          user: formatUser(c.user as Record<string, unknown> | undefined),
        }));

        return jsonResult({ videoId, count: comments.length, comments });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/tiktok-video-comments.ts
git commit -m "feat(tiktok): add video comments tool"
```

---

### Task 11: PluginConfig + Plugin Registration

**Files:**
- Modify: `src/types/plugin-config.ts` (add 3 fields)
- Modify: `src/plugin.ts` (add imports + registration block)

**Step 1: Add TikTok fields to PluginConfig**

Add after the existing Instagram fields in `src/types/plugin-config.ts`:

```typescript
  // TikTok (Playwright)
  tiktok_tokens_path?: string;
  tiktok_username?: string;
  tiktok_password?: string;
```

**Step 2: Add imports to plugin.ts**

Add after the Instagram import block (around line 67):

```typescript
import { TikTokClientManager } from "./auth/tiktok-client-manager.js";
import { createTikTokAuthTool } from "./tools/tiktok-auth-tool.js";
import { createTikTokProfileTool, createTikTokGetUserTool } from "./tools/tiktok-profile.js";
import { createTikTokUserVideosTool } from "./tools/tiktok-user-videos.js";
import { createTikTokVideoDetailsTool } from "./tools/tiktok-video-details.js";
import { createTikTokFeedTool } from "./tools/tiktok-feed.js";
import { createTikTokSearchVideosTool, createTikTokSearchUsersTool } from "./tools/tiktok-search.js";
import { createTikTokTrendingTool } from "./tools/tiktok-trending.js";
import { createTikTokVideoCommentsTool } from "./tools/tiktok-video-comments.js";
```

**Step 3: Add registration block to plugin.ts**

Add after the Instagram registration block (after line 467):

```typescript
  // TikTok tools — register unconditionally, no Google credentials required
  const tiktokTokensPath =
    config.tiktok_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-tiktok-tokens.json",
    );

  const tiktokManager = new TikTokClientManager(tiktokTokensPath);

  reg(createTikTokAuthTool(tiktokManager, config));
  reg(createTikTokProfileTool(tiktokManager));
  reg(createTikTokGetUserTool(tiktokManager));
  reg(createTikTokUserVideosTool(tiktokManager));
  reg(createTikTokVideoDetailsTool(tiktokManager));
  reg(createTikTokFeedTool(tiktokManager));
  reg(createTikTokSearchVideosTool(tiktokManager));
  reg(createTikTokSearchUsersTool(tiktokManager));
  reg(createTikTokTrendingTool(tiktokManager));
  reg(createTikTokVideoCommentsTool(tiktokManager));
```

**Step 4: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/types/plugin-config.ts src/plugin.ts
git commit -m "feat(tiktok): register 10 TikTok tools in plugin"
```

---

### Task 12: Skill File

**Files:**
- Create: `skills/tiktok.SKILL.md`

**Step 1: Create the skill documentation**

```markdown
---
name: tiktok
description: TikTok access — browse feed, search videos, view profiles, trending content, and read comments.
metadata: {"openclaw": {"emoji": "🎵"}}
---

# TikTok

Browse your For You page, search videos and users, view profiles, explore trending content, and read comments.

## First-Time Setup

TikTok uses browser-based authentication via Playwright — no API token needed.

1. Make sure Playwright browsers are installed: `npx playwright install chromium`
2. Save your TikTok credentials once (so you never have to type them again):

\```bash
openclaw config set plugins.entries.omniclaw.config.tiktok_username "your_email_or_username"
openclaw config set plugins.entries.omniclaw.config.tiktok_password "your_password"
\```

3. Call `tiktok_auth_setup` with no arguments — the tool reads your credentials automatically.

If your account uses MFA, the browser will stay open for you to complete the verification manually.

## Available Tools

- `tiktok_auth_setup` — Authenticate via browser login
- `tiktok_profile` — Get your own TikTok profile
- `tiktok_get_user` — Get any user's profile by username
- `tiktok_user_videos` — Get a user's recent videos
- `tiktok_video_details` — Get full details for a specific video by URL or ID
- `tiktok_feed` — Get For You page recommendations
- `tiktok_search_videos` — Search for videos by keyword
- `tiktok_search_users` — Search for users by keyword
- `tiktok_trending` — Get trending/popular videos
- `tiktok_video_comments` — Get comments on a video

## Workflow

1. Call `tiktok_auth_setup` with no arguments (reads credentials from config).
2. Use `tiktok_profile` to verify your account info.
3. Browse with `tiktok_feed` or `tiktok_trending`.
4. Search with `tiktok_search_videos` or `tiktok_search_users`.
5. View details with `tiktok_get_user`, `tiktok_user_videos`, or `tiktok_video_details`.
6. Read engagement with `tiktok_video_comments`.

## Error Handling

If any tool returns `"error": "auth_required"`, call `tiktok_auth_setup` first.

If you get session expired errors, call `tiktok_auth_setup` again to re-authenticate. TikTok sessions may expire after a period of inactivity.
```

(Note: remove the backslash before the triple backticks — they're escaped here only to avoid breaking the markdown.)

**Step 2: Commit**

```bash
git add skills/tiktok.SKILL.md
git commit -m "feat(tiktok): add TikTok skill documentation"
```

---

### Task 13: Integration Tests

**Files:**
- Create: `tests/integration/tiktok.test.ts`

**Step 1: Create the integration test file**

Model after `tests/integration/instagram.test.ts`. Tests require a valid TikTok account.

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { TikTokClientManager } from "../../src/auth/tiktok-client-manager.js";
import { createTikTokAuthTool } from "../../src/tools/tiktok-auth-tool.js";
import { createTikTokProfileTool, createTikTokGetUserTool } from "../../src/tools/tiktok-profile.js";
import { createTikTokUserVideosTool } from "../../src/tools/tiktok-user-videos.js";
import { createTikTokVideoDetailsTool } from "../../src/tools/tiktok-video-details.js";
import { createTikTokFeedTool } from "../../src/tools/tiktok-feed.js";
import { createTikTokSearchVideosTool, createTikTokSearchUsersTool } from "../../src/tools/tiktok-search.js";
import { createTikTokTrendingTool } from "../../src/tools/tiktok-trending.js";
import { createTikTokVideoCommentsTool } from "../../src/tools/tiktok-video-comments.js";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { PluginConfig } from "../../src/types/plugin-config.js";

const configPath = join(homedir(), ".openclaw", "openclaw.json");
let config: PluginConfig = {} as PluginConfig;
try {
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  config = (raw?.plugins?.entries?.omniclaw?.config ?? {}) as PluginConfig;
} catch {
  // Use env vars as fallback
}

const tiktokUsername = process.env.TIKTOK_USERNAME ?? config.tiktok_username;
const tiktokPassword = process.env.TIKTOK_PASSWORD ?? config.tiktok_password;

const tokensPath = join(homedir(), ".openclaw", "omniclaw-tiktok-tokens.json");
const manager = new TikTokClientManager(tokensPath);

describe("TikTok Integration", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    if (!manager.hasCredentials("default")) {
      const authTool = createTikTokAuthTool(manager, {
        ...config,
        tiktok_username: tiktokUsername,
        tiktok_password: tiktokPassword,
      });
      const result = await authTool.execute("test", {});
      const data = JSON.parse(result.content[0].text);
      expect(data.status).toMatch(/authenticated|already_authenticated/);
    }
  });

  it("tiktok_profile — gets own profile", async () => {
    const tool = createTikTokProfileTool(manager);
    const result = await tool.execute("test", {});
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.uniqueId).toBeTruthy();
  });

  it("tiktok_get_user — gets a public user", async () => {
    const tool = createTikTokGetUserTool(manager);
    const result = await tool.execute("test", { username: "tiktok" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.uniqueId).toBeTruthy();
  });

  it("tiktok_user_videos — gets user videos", async () => {
    const tool = createTikTokUserVideosTool(manager);
    const result = await tool.execute("test", { username: "tiktok", count: 3 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.videos).toBeDefined();
  });

  it("tiktok_feed — gets For You page", async () => {
    const tool = createTikTokFeedTool(manager);
    const result = await tool.execute("test", { count: 5 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.videos).toBeDefined();
  });

  it("tiktok_search_videos — searches videos", async () => {
    const tool = createTikTokSearchVideosTool(manager);
    const result = await tool.execute("test", { query: "cooking", count: 5 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.videos).toBeDefined();
  });

  it("tiktok_search_users — searches users", async () => {
    const tool = createTikTokSearchUsersTool(manager);
    const result = await tool.execute("test", { query: "cooking", count: 5 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.users).toBeDefined();
  });

  it("tiktok_trending — gets trending videos", async () => {
    const tool = createTikTokTrendingTool(manager);
    const result = await tool.execute("test", { count: 5 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.videos).toBeDefined();
  });

  it("tiktok_video_comments — gets comments on a video", async () => {
    // First get a video ID from trending
    const trendingTool = createTikTokTrendingTool(manager);
    const trendingResult = await trendingTool.execute("test", { count: 1 });
    const trendingData = JSON.parse(trendingResult.content[0].text);

    if (trendingData.videos?.length > 0) {
      const videoId = trendingData.videos[0].id;
      const commentsTool = createTikTokVideoCommentsTool(manager);
      const result = await commentsTool.execute("test", { video: videoId, count: 5 });
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBeUndefined();
      expect(data.comments).toBeDefined();
    }
  });

  it("tiktok_video_details — gets video details", async () => {
    // First get a video ID from trending
    const trendingTool = createTikTokTrendingTool(manager);
    const trendingResult = await trendingTool.execute("test", { count: 1 });
    const trendingData = JSON.parse(trendingResult.content[0].text);

    if (trendingData.videos?.length > 0) {
      const videoId = trendingData.videos[0].id;
      const detailsTool = createTikTokVideoDetailsTool(manager);
      const result = await detailsTool.execute("test", { video: videoId });
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBeUndefined();
      expect(data.id).toBeTruthy();
    }
  });
});
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Run the integration tests**

Run: `pnpm vitest run tests/integration/tiktok.test.ts`
Expected: All tests pass (requires valid TikTok session)

**Step 4: Commit**

```bash
git add tests/integration/tiktok.test.ts
git commit -m "test(tiktok): add integration tests for all 10 tools"
```

---

### Task 14: Update CLAUDE.md + Build Verification

**Files:**
- Modify: `CLAUDE.md` (add TikTok to Done table)

**Step 1: Move TikTok from Planned to Done in CLAUDE.md**

Remove the TikTok row from the Planned table and add to Done:

```
| TikTok | 10 | `tiktok` | `docs/plans/2026-02-27-tiktok-integration-design.md` | Playwright browser auth, read-only |
```

**Step 2: Full build verification**

Run: `pnpm build`
Expected: Clean compile, no errors

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add TikTok to completed integrations in CLAUDE.md"
```

---

### Task 15: Final Endpoint Tuning (Interactive)

After all tools are built and the build compiles, the exact TikTok API endpoints and response shapes need to be verified against live network traffic. This task is interactive — requires running each tool against a real TikTok account and adjusting endpoint URLs and response parsing based on actual API responses.

**Step 1: Authenticate with TikTok**

Run the auth tool manually, observe the login flow, confirm `sessionid` cookie is captured.

**Step 2: Test each tool and adjust**

For each tool, run it and inspect the raw JSON response. If the response shape differs from what the code expects (e.g., `itemList` vs `items`, different nested structure), update the tool's response parsing accordingly.

Common things to look for:
- TikTok may use `statusCode` field to indicate errors (e.g., `statusCode: 10000` = success)
- Response may be wrapped in `{ statusCode, ..., data: { ... } }`
- Field names may differ slightly from what's documented
- Some endpoints may redirect or require different URL patterns

**Step 3: Commit any adjustments**

```bash
git add -u
git commit -m "fix(tiktok): tune API endpoints and response parsing from live testing"
```
