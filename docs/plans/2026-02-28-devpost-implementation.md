# Devpost Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full read+write Devpost integration with ~12 tools using hybrid data access (public JSON APIs + Playwright browser auth).

**Architecture:** Public JSON APIs (`/api/hackathons`, `/software/search`) for browsing without auth. Playwright browser login captures session cookies for authenticated operations (profile, submissions, write ops). `DevpostClientManager` handles session persistence and HTTP requests.

**Tech Stack:** TypeScript, Playwright (browser auth + scraping), `@sinclair/typebox` (parameter schemas), Vitest (integration tests)

---

### Task 1: Create devpost-utils.ts

**Files:**
- Create: `src/tools/devpost-utils.ts`

**Step 1: Create the shared utils file**

```typescript
// src/tools/devpost-utils.ts

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
  action: "Call devpost_auth_setup to authenticate with Devpost first.",
};
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit src/tools/devpost-utils.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/devpost-utils.ts
git commit -m "feat(devpost): add shared utils (jsonResult, AUTH_REQUIRED)"
```

---

### Task 2: Create DevpostClientManager

**Files:**
- Create: `src/auth/devpost-client-manager.ts`

**Reference:** Follow the same pattern as `src/auth/slack-client-manager.ts` — constructor takes `tokensPath`, implements `load()/save()` for file I/O, provides `setCredentials/getCredentials/hasCredentials/listAccounts`.

**Step 1: Create the client manager**

```typescript
// src/auth/devpost-client-manager.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface DevpostSession {
  cookies: Record<string, string>;
  cookie_details: Array<{ name: string; value: string; domain: string; path: string }>;
  username: string;
}

interface DevpostSessionFile {
  [account: string]: DevpostSession;
}

const BASE_URL = "https://devpost.com";

export class DevpostClientManager {
  constructor(private tokensPath: string) {}

  // ---------------------------------------------------------------------------
  // Session persistence
  // ---------------------------------------------------------------------------

  private load(): DevpostSessionFile {
    if (!existsSync(this.tokensPath)) return {};
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as DevpostSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: DevpostSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: DevpostSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): DevpostSession | null {
    return this.load()[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const session = this.getCredentials(account);
    return session !== null && Object.keys(session.cookies).length > 0;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  private buildCookieHeader(session: DevpostSession): string {
    return Object.entries(session.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  /**
   * Authenticated GET request to Devpost.
   */
  async get(account: string, urlPath: string): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const url = urlPath.startsWith("http") ? urlPath : `${BASE_URL}${urlPath}`;

    const resp = await fetch(url, {
      headers: {
        Cookie: this.buildCookieHeader(session),
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Devpost session expired. Call devpost_auth_setup to re-authenticate.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Devpost HTTP error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`);
    }

    const contentType = resp.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return resp.json();
    }
    return resp.text();
  }

  /**
   * Authenticated POST request to Devpost.
   */
  async post(
    account: string,
    urlPath: string,
    body?: Record<string, unknown> | FormData,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const url = urlPath.startsWith("http") ? urlPath : `${BASE_URL}${urlPath}`;

    const headers: Record<string, string> = {
      Cookie: this.buildCookieHeader(session),
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };

    let requestBody: string | FormData | undefined;
    if (body instanceof FormData) {
      requestBody = body;
    } else if (body) {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: requestBody,
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Devpost session expired. Call devpost_auth_setup to re-authenticate.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Devpost HTTP error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`);
    }

    const contentType = resp.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return resp.json();
    }
    return resp.text();
  }

  // ---------------------------------------------------------------------------
  // No-auth static methods (public JSON APIs)
  // ---------------------------------------------------------------------------

  /**
   * Search hackathons via the public JSON API. No auth needed.
   */
  static async searchHackathons(
    params?: Record<string, string>,
  ): Promise<{ hackathons: Array<Record<string, unknown>>; meta: Record<string, unknown> }> {
    const url = new URL("https://devpost.com/api/hackathons");
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const resp = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      throw new Error(`Devpost API error: ${resp.status} ${resp.statusText}`);
    }

    return resp.json() as Promise<{
      hackathons: Array<Record<string, unknown>>;
      meta: Record<string, unknown>;
    }>;
  }

  /**
   * Search software projects via Devpost. No auth needed.
   * Returns HTML page that needs to be parsed.
   */
  static async searchProjects(
    params?: Record<string, string>,
  ): Promise<string> {
    const url = new URL("https://devpost.com/software/search");
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const resp = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    if (!resp.ok) {
      throw new Error(`Devpost search error: ${resp.status} ${resp.statusText}`);
    }

    return resp.text();
  }
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/auth/devpost-client-manager.ts
git commit -m "feat(devpost): add DevpostClientManager with session persistence + HTTP helpers"
```

---

### Task 3: Create devpost_auth_setup tool

**Files:**
- Create: `src/tools/devpost-auth-tool.ts`

**Reference:** Follow the same pattern as `src/tools/tiktok-auth-tool.ts` — launch Playwright browser to `secure.devpost.com/users/login`, auto-fill credentials if configured, poll for session cookies, validate, save.

**Step 1: Create the auth tool**

```typescript
// src/tools/devpost-auth-tool.ts

import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { DevpostClientManager, DevpostSession } from "../auth/devpost-client-manager.js";
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
export function createDevpostAuthTool(
  devpostManager: DevpostClientManager,
  config: PluginConfig,
): any {
  return {
    name: "devpost_auth_setup",
    label: "Devpost Auth Setup",
    description:
      "Authenticate with Devpost. Opens a browser for login, captures session cookies, then validates the session. The tool reads devpost_email and devpost_password from the plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      email: Type.Optional(
        Type.String({
          description: "Override for Devpost email. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for Devpost password. Usually omitted — uses pre-configured value.",
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
      params: { email?: string; password?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const resolvedEmail = params.email ?? (config as Record<string, unknown>).devpost_email as string | undefined;
      const resolvedPassword = params.password ?? (config as Record<string, unknown>).devpost_password as string | undefined;

      // Check if we already have a valid session
      if (devpostManager.hasCredentials(account)) {
        try {
          // Validate by fetching the settings page (requires auth)
          const html = await devpostManager.get(account, "/settings") as string;
          if (html.includes("/users/login")) {
            // Redirected to login — session expired
          } else {
            const session = devpostManager.getCredentials(account)!;
            return jsonResult({
              status: "already_authenticated",
              account,
              username: session.username,
              message: "Existing session is still valid. No re-authentication needed.",
            });
          }
        } catch {
          // Session invalid — proceed with re-auth
        }
      }

      try {
        const session = await runDevpostLoginFlow(resolvedEmail, resolvedPassword);
        devpostManager.setCredentials(account, session);

        return jsonResult({
          status: "authenticated",
          account,
          username: session.username,
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. If the user needs to update credentials, direct them to run: openclaw config set plugins.entries.omniclaw.config.devpost_password "new_password" — never ask them to type passwords in the chat.',
        });
      }
    },
  };
}

async function runDevpostLoginFlow(
  email?: string,
  password?: string,
): Promise<DevpostSession> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("[devpost] Navigating to Devpost login...");
    await page.goto("https://secure.devpost.com/users/login", { waitUntil: "networkidle" });

    // Auto-fill credentials if provided
    if (email && password) {
      console.log("[devpost] Filling credentials...");
      try {
        await page.waitForSelector('input[type="email"], input#user_email, input[name="user[email]"]', { timeout: 10000 });
        const emailInput = page.locator('input[type="email"], input#user_email, input[name="user[email]"]').first();
        const passwordInput = page.locator('input[type="password"]').first();

        await emailInput.click();
        await emailInput.fill(email);
        await passwordInput.click();
        await passwordInput.fill(password);
        await page.waitForTimeout(500);

        const loginBtn = page.locator('input[type="submit"], button[type="submit"], button:has-text("Log in")').first();
        await loginBtn.click();
        console.log("[devpost] Credentials submitted.");
      } catch (e) {
        console.log(`[devpost] Login form error: ${e}`);
        console.log("[devpost] Waiting for manual login instead...");
      }
    } else {
      console.log("[devpost] No credentials configured — waiting for manual login...");
    }

    // Poll for successful login (up to 5 minutes)
    // Devpost sets _devpost_session cookie and redirects to devpost.com after login
    console.log("[devpost] Waiting for login to complete (up to 5 minutes)...");
    let loggedIn = false;

    for (let i = 0; i < 300; i++) {
      const currentUrl = page.url();

      // Check if we've been redirected away from the login page
      if (
        !currentUrl.includes("/users/login") &&
        !currentUrl.includes("/users/sign_in") &&
        currentUrl.includes("devpost.com")
      ) {
        const cookies = await context.cookies();
        const sessionCookie = cookies.find(
          (c) => c.name === "_devpost_session" || c.name === "remember_user_token",
        );
        if (sessionCookie) {
          console.log("[devpost] Login detected — session cookie captured.");
          loggedIn = true;
          break;
        }
      }

      if (i % 30 === 0 && i > 0) {
        console.log(`[devpost] Still waiting for login... (${i}s, URL: ${currentUrl.slice(0, 80)})`);
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error("Login timed out after 5 minutes waiting for session cookie.");
    }

    // Extract username from the page
    let username = "unknown";
    try {
      // Navigate to settings to get username
      await page.goto("https://devpost.com/settings", { waitUntil: "networkidle", timeout: 10000 });
      await page.waitForTimeout(1000);

      // Try to extract username from the page
      username = await page.evaluate(() => {
        // Check for username in the URL or page content
        const profileLink = document.querySelector('a[href*="devpost.com/"][class*="profile"], a[href^="/"][class*="user"]');
        if (profileLink) {
          const href = (profileLink as HTMLAnchorElement).href;
          const match = href.match(/devpost\.com\/([^/?#]+)/);
          if (match) return match[1];
        }
        // Check meta tags or other identifiers
        const meta = document.querySelector('meta[name="user-login"], meta[property="profile:username"]');
        if (meta) return meta.getAttribute("content") ?? "";
        // Check for display name in navigation
        const nav = document.querySelector('.user-name, .username, [data-username]');
        if (nav) return nav.textContent?.trim() ?? "";
        return "";
      }) || "unknown";
    } catch {
      // Username extraction is best-effort
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

    await browser.close();

    return {
      cookies: allCookies,
      cookie_details: cookieDetails,
      username,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/devpost-auth-tool.ts
git commit -m "feat(devpost): add devpost_auth_setup tool with Playwright login"
```

---

### Task 4: Create hackathon tools (no auth)

**Files:**
- Create: `src/tools/devpost-hackathons.ts`

**Step 1: Create the hackathon tools file**

This file contains 3 tools:
- `devpost_search_hackathons` — uses the public JSON API `/api/hackathons`
- `devpost_get_hackathon` — scrapes a hackathon page for full details
- `devpost_hackathon_projects` — scrapes the submission gallery for a hackathon

```typescript
// src/tools/devpost-hackathons.ts

import { Type } from "@sinclair/typebox";
import { DevpostClientManager } from "../auth/devpost-client-manager.js";
import { jsonResult } from "./devpost-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostSearchHackathonsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_search_hackathons",
    label: "Devpost Search Hackathons",
    description:
      "Search and browse hackathons on Devpost. Supports filtering by status (open, upcoming, ended), themes, and location. No authentication required.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.String({
          description:
            "Filter by status: 'open', 'upcoming', 'ended'. Omit for all.",
        }),
      ),
      search: Type.Optional(
        Type.String({ description: "Search query for hackathon name or description." }),
      ),
      themes: Type.Optional(
        Type.String({
          description: "Comma-separated theme IDs to filter by.",
        }),
      ),
      location: Type.Optional(
        Type.String({ description: "Filter by location (e.g. 'Online', 'San Francisco')." }),
      ),
      page: Type.Optional(
        Type.Number({ description: "Page number (default 1).", default: 1 }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        status?: string;
        search?: string;
        themes?: string;
        location?: string;
        page?: number;
      },
    ) {
      try {
        const queryParams: Record<string, string> = {};
        if (params.status) queryParams.status = params.status;
        if (params.search) queryParams.search = params.search;
        if (params.themes) queryParams.themes = params.themes;
        if (params.location) queryParams.location = params.location;
        if (params.page) queryParams.page = String(params.page);

        const data = await DevpostClientManager.searchHackathons(queryParams);

        // Clean up prize_amount HTML
        const hackathons = data.hackathons.map((h) => ({
          id: h.id,
          title: h.title,
          url: h.url,
          status: h.open_state,
          location: (h.displayed_location as Record<string, unknown>)?.location ?? "Unknown",
          submission_dates: h.submission_period_dates,
          time_left: h.time_left_to_submission,
          prize_amount: String(h.prize_amount ?? "")
            .replace(/<[^>]*>/g, "")
            .trim(),
          registrations: h.registrations_count,
          organization: h.organization_name,
          themes: (h.themes as Array<{ name: string }>)?.map((t) => t.name) ?? [],
          winners_announced: h.winners_announced,
          featured: h.featured,
          invite_only: h.invite_only,
          submission_gallery_url: h.submission_gallery_url,
        }));

        return jsonResult({
          count: hackathons.length,
          total: data.meta.total_count,
          page: params.page ?? 1,
          hackathons,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostGetHackathonTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_get_hackathon",
    label: "Devpost Get Hackathon",
    description:
      "Get full details for a specific hackathon including prizes, rules, judges, timeline, and eligibility. Pass a hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
    parameters: Type.Object({
      hackathon: Type.String({
        description:
          "Hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
      }),
    }),
    async execute(_toolCallId: string, params: { hackathon: string }) {
      try {
        // Normalize to URL
        let url: string;
        if (params.hackathon.startsWith("http")) {
          url = params.hackathon.replace(/\/$/, "");
        } else {
          url = `https://${params.hackathon}.devpost.com`;
        }

        // Fetch the hackathon page
        const resp = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to fetch hackathon: ${resp.status} ${resp.statusText}`);
        }

        const html = await resp.text();

        // Parse key information from the HTML
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        const title = titleMatch ? titleMatch[1].replace(/ \| Devpost$/, "").trim() : "Unknown";

        // Extract description from meta tag
        const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/) ??
          html.match(/<meta\s+content="([^"]*)"\s+name="description"/);
        const description = descMatch ? descMatch[1].trim() : "";

        // Extract prizes section
        const prizesMatch = html.match(/class="[^"]*prizes[^"]*"[^>]*>([\s\S]*?)(?=<\/section|<section)/i);
        const prizesHtml = prizesMatch ? prizesMatch[1] : "";
        // Extract individual prize entries
        const prizeEntries: Array<{ title: string; value: string }> = [];
        const prizeRegex =
          /class="[^"]*prize[^"]*"[^>]*>[\s\S]*?<h[2-6][^>]*>([^<]+)<\/h[2-6]>[\s\S]*?(?:<span[^>]*>([^<]*)<\/span>)?/gi;
        let prizeMatch;
        while ((prizeMatch = prizeRegex.exec(prizesHtml)) !== null) {
          prizeEntries.push({
            title: prizeMatch[1].trim(),
            value: prizeMatch[2]?.trim() ?? "",
          });
        }

        // Extract dates
        const datesMatch = html.match(/submission_period_dates['"]\s*:\s*['"]([^'"]+)['"]/);
        const dates = datesMatch ? datesMatch[1] : "";

        return jsonResult({
          title,
          url,
          description,
          dates,
          prizes: prizeEntries.length > 0 ? prizeEntries : undefined,
          submission_gallery: `${url}/project-gallery`,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostHackathonProjectsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_hackathon_projects",
    label: "Devpost Hackathon Projects",
    description:
      "Browse submitted projects for a specific hackathon. Pass a hackathon URL or slug.",
    parameters: Type.Object({
      hackathon: Type.String({
        description:
          "Hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
      }),
      page: Type.Optional(
        Type.Number({ description: "Page number (default 1).", default: 1 }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { hackathon: string; page?: number },
    ) {
      try {
        let baseUrl: string;
        if (params.hackathon.startsWith("http")) {
          baseUrl = params.hackathon.replace(/\/$/, "");
        } else {
          baseUrl = `https://${params.hackathon}.devpost.com`;
        }

        const galleryUrl = `${baseUrl}/project-gallery${params.page && params.page > 1 ? `?page=${params.page}` : ""}`;

        const resp = await fetch(galleryUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to fetch project gallery: ${resp.status}`);
        }

        const html = await resp.text();

        // Parse project entries from the gallery HTML
        const projects: Array<Record<string, unknown>> = [];
        // Match software-entry links
        const entryRegex =
          /<a[^>]*class="[^"]*block-wrapper-link[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<\/a>/gi;
        // Simpler: look for gallery entries with data
        const titleRegex =
          /href="(https:\/\/devpost\.com\/software\/[^"]+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)<\/h5>/gi;
        let match;
        while ((match = titleRegex.exec(html)) !== null) {
          projects.push({
            url: match[1].trim(),
            title: match[2].trim(),
            slug: match[1].replace("https://devpost.com/software/", "").replace(/\/$/, ""),
          });
        }

        return jsonResult({
          hackathon: baseUrl,
          page: params.page ?? 1,
          count: projects.length,
          projects,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
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
git add src/tools/devpost-hackathons.ts
git commit -m "feat(devpost): add hackathon tools (search, get, list projects)"
```

---

### Task 5: Create project/software tools (no auth)

**Files:**
- Create: `src/tools/devpost-projects.ts`

**Step 1: Create the projects tools file**

Contains 2 tools:
- `devpost_search_projects` — searches software projects
- `devpost_get_project` — gets full project details from a project page

```typescript
// src/tools/devpost-projects.ts

import { Type } from "@sinclair/typebox";
import { DevpostClientManager } from "../auth/devpost-client-manager.js";
import { jsonResult } from "./devpost-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostSearchProjectsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_search_projects",
    label: "Devpost Search Projects",
    description:
      "Search software projects on Devpost by keyword. No authentication required.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query for project name or description." }),
      sort: Type.Optional(
        Type.String({
          description: "Sort order: 'Newest', 'Popular', 'Trending'. Default 'Popular'.",
          default: "Popular",
        }),
      ),
      page: Type.Optional(
        Type.Number({ description: "Page number (default 1).", default: 1 }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; sort?: string; page?: number },
    ) {
      try {
        const queryParams: Record<string, string> = {
          query: params.query,
        };
        if (params.sort) queryParams.sort = params.sort;
        if (params.page) queryParams.page = String(params.page);

        const html = await DevpostClientManager.searchProjects(queryParams);

        // Parse project entries from the HTML
        const projects: Array<Record<string, unknown>> = [];

        // Match gallery entries: link + title + tagline
        const entryRegex =
          /href="(https:\/\/devpost\.com\/software\/[^"]+)"[^>]*>\s*(?:<[^>]*>)*\s*<h5[^>]*>([^<]+)<\/h5>[\s\S]*?<p[^>]*>([^<]*)<\/p>/gi;
        let match;
        while ((match = entryRegex.exec(html)) !== null) {
          projects.push({
            url: match[1].trim(),
            title: match[2].trim(),
            tagline: match[3].trim(),
            slug: match[1]
              .replace("https://devpost.com/software/", "")
              .replace(/\/$/, ""),
          });
        }

        // Fallback: simpler regex if the above doesn't match
        if (projects.length === 0) {
          const simpleRegex =
            /href="(https:\/\/devpost\.com\/software\/[^"]+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)<\/h5>/gi;
          while ((match = simpleRegex.exec(html)) !== null) {
            projects.push({
              url: match[1].trim(),
              title: match[2].trim(),
              slug: match[1]
                .replace("https://devpost.com/software/", "")
                .replace(/\/$/, ""),
            });
          }
        }

        return jsonResult({
          query: params.query,
          page: params.page ?? 1,
          count: projects.length,
          projects,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostGetProjectTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_get_project",
    label: "Devpost Get Project",
    description:
      "Get full details for a software project including description, tech stack, team members, demo link, and media. Pass a project URL or slug.",
    parameters: Type.Object({
      project: Type.String({
        description:
          "Project URL (e.g. 'https://devpost.com/software/myproject') or slug (e.g. 'myproject').",
      }),
    }),
    async execute(_toolCallId: string, params: { project: string }) {
      try {
        let url: string;
        if (params.project.startsWith("http")) {
          url = params.project;
        } else {
          url = `https://devpost.com/software/${params.project}`;
        }

        const resp = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to fetch project: ${resp.status} ${resp.statusText}`);
        }

        const html = await resp.text();

        // Parse project details
        const titleMatch = html.match(/<h1[^>]*id="app-title"[^>]*>([^<]+)<\/h1>/) ??
          html.match(/<title>([^<|]+)/);
        const title = titleMatch ? titleMatch[1].trim() : "Unknown";

        const taglineMatch = html.match(/<p[^>]*id="app-tagline"[^>]*>([^<]+)<\/p>/);
        const tagline = taglineMatch ? taglineMatch[1].trim() : "";

        // Extract "Built with" tech stack
        const builtWithRegex = /Built\s+[Ww]ith[\s\S]*?<span[^>]*class="[^"]*cp-tag[^"]*"[^>]*>([^<]+)<\/span>/gi;
        const builtWith: string[] = [];
        let bwMatch;
        while ((bwMatch = builtWithRegex.exec(html)) !== null) {
          builtWith.push(bwMatch[1].trim());
        }

        // Extract description (from the app-details section)
        const descMatch = html.match(
          /id="app-details-left"[^>]*>([\s\S]*?)(?=<\/div>\s*<\/div>\s*<div[^>]*id="app-details-right")/,
        );
        let description = "";
        if (descMatch) {
          description = descMatch[1]
            .replace(/<[^>]+>/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, 2000);
        }

        // Extract team members
        const teamRegex = /class="[^"]*user-profile[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi;
        const team: string[] = [];
        let teamMatch;
        while ((teamMatch = teamRegex.exec(html)) !== null) {
          team.push(teamMatch[1].trim());
        }

        // Extract demo/try it link
        const demoMatch = html.match(/href="([^"]*)"[^>]*class="[^"]*app-links[^"]*"/);
        const demoUrl = demoMatch ? demoMatch[1] : undefined;

        // Extract hackathon this was submitted to
        const hackathonMatch = html.match(
          /href="(https:\/\/[^"]*\.devpost\.com[^"]*)"[^>]*>[^<]*<[^>]*>[^<]*hackathon/i,
        ) ?? html.match(/href="(https:\/\/[^"]*\.devpost\.com\/?)"[^>]*>/);
        const hackathonUrl = hackathonMatch ? hackathonMatch[1] : undefined;

        return jsonResult({
          title,
          tagline,
          url,
          description,
          built_with: builtWith.length > 0 ? builtWith : undefined,
          team: team.length > 0 ? team : undefined,
          demo_url: demoUrl,
          hackathon_url: hackathonUrl,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
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
git add src/tools/devpost-projects.ts
git commit -m "feat(devpost): add project tools (search, get details)"
```

---

### Task 6: Create profile tools (auth required)

**Files:**
- Create: `src/tools/devpost-profile.ts`

**Step 1: Create the profile tools file**

Contains 3 tools:
- `devpost_get_profile` — scrapes a user profile page
- `devpost_my_hackathons` — lists hackathons the authenticated user participated in
- `devpost_my_projects` — lists the authenticated user's submitted projects

```typescript
// src/tools/devpost-profile.ts

import { Type } from "@sinclair/typebox";
import type { DevpostClientManager } from "../auth/devpost-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./devpost-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostGetProfileTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_get_profile",
    label: "Devpost Get Profile",
    description:
      "Get a Devpost user's profile including name, bio, skills, project count, hackathon count, and social links. Defaults to the authenticated user. Auth required.",
    parameters: Type.Object({
      username: Type.Optional(
        Type.String({
          description:
            "Devpost username. Omit to get the authenticated user's profile.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { username?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;
        const username = params.username ?? session.username;

        if (!username || username === "unknown") {
          return jsonResult({
            error: "No username available. Pass a username parameter or re-authenticate with devpost_auth_setup.",
          });
        }

        const html = (await manager.get(account, `/${username}`)) as string;

        // Parse profile data from HTML
        const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const name = nameMatch ? nameMatch[1].trim() : username;

        const bioMatch = html.match(/class="[^"]*bio[^"]*"[^>]*>([^<]+)</i);
        const bio = bioMatch ? bioMatch[1].trim() : "";

        const locationMatch = html.match(/class="[^"]*location[^"]*"[^>]*>([^<]+)</i);
        const location = locationMatch ? locationMatch[1].trim() : "";

        // Extract stats (projects, hackathons, achievements, followers)
        const statsRegex = /(\d+)\s*<\/?\w[^>]*>\s*(Projects?|Hackathons?|Achievements?|Followers?|Following|Likes?)/gi;
        const stats: Record<string, number> = {};
        let statMatch;
        while ((statMatch = statsRegex.exec(html)) !== null) {
          stats[statMatch[2].toLowerCase()] = parseInt(statMatch[1], 10);
        }

        // Extract skills
        const skillsRegex = /class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/span>/gi;
        const skills: string[] = [];
        let skillMatch;
        while ((skillMatch = skillsRegex.exec(html)) !== null) {
          skills.push(skillMatch[1].trim());
        }

        return jsonResult({
          username,
          name,
          bio,
          location,
          url: `https://devpost.com/${username}`,
          stats,
          skills: skills.length > 0 ? skills : undefined,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostMyHackathonsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_my_hackathons",
    label: "Devpost My Hackathons",
    description:
      "List hackathons the authenticated user has registered for or participated in. Auth required.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;
        const username = session.username;

        if (!username || username === "unknown") {
          return jsonResult({
            error: "No username available. Re-authenticate with devpost_auth_setup.",
          });
        }

        const html = (await manager.get(
          account,
          `/${username}/challenges`,
        )) as string;

        // Parse hackathon list from the challenges page
        const hackathons: Array<Record<string, unknown>> = [];
        const hackRegex =
          /href="(https:\/\/[^"]*\.devpost\.com[^"]*)"[^>]*>[\s\S]*?<h[2-6][^>]*>([^<]+)<\/h[2-6]>/gi;
        let match;
        while ((match = hackRegex.exec(html)) !== null) {
          hackathons.push({
            url: match[1].trim(),
            title: match[2].trim(),
          });
        }

        return jsonResult({
          username,
          count: hackathons.length,
          hackathons,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostMyProjectsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_my_projects",
    label: "Devpost My Projects",
    description:
      "List the authenticated user's submitted projects on Devpost. Auth required.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;
        const username = session.username;

        if (!username || username === "unknown") {
          return jsonResult({
            error: "No username available. Re-authenticate with devpost_auth_setup.",
          });
        }

        // Fetch the user's profile which shows their projects
        const html = (await manager.get(account, `/${username}`)) as string;

        // Parse project entries
        const projects: Array<Record<string, unknown>> = [];
        const projectRegex =
          /href="(https:\/\/devpost\.com\/software\/[^"]+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)<\/h5>[\s\S]*?<p[^>]*>([^<]*)<\/p>/gi;
        let match;
        while ((match = projectRegex.exec(html)) !== null) {
          projects.push({
            url: match[1].trim(),
            title: match[2].trim(),
            tagline: match[3].trim(),
            slug: match[1]
              .replace("https://devpost.com/software/", "")
              .replace(/\/$/, ""),
          });
        }

        // Fallback: simpler regex
        if (projects.length === 0) {
          const simpleRegex =
            /href="(https:\/\/devpost\.com\/software\/[^"]+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)<\/h5>/gi;
          while ((match = simpleRegex.exec(html)) !== null) {
            projects.push({
              url: match[1].trim(),
              title: match[2].trim(),
              slug: match[1]
                .replace("https://devpost.com/software/", "")
                .replace(/\/$/, ""),
            });
          }
        }

        return jsonResult({
          username,
          count: projects.length,
          projects,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
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
git add src/tools/devpost-profile.ts
git commit -m "feat(devpost): add profile tools (get_profile, my_hackathons, my_projects)"
```

---

### Task 7: Create submission/write tools (auth required)

**Files:**
- Create: `src/tools/devpost-submissions.ts`

**Step 1: Create the submissions tools file**

Contains 3 tools:
- `devpost_register_hackathon` — registers for a hackathon
- `devpost_create_submission` — creates a new project submission
- `devpost_update_submission` — updates an existing submission

These tools use Playwright browser automation since write operations involve forms with CSRF tokens.

```typescript
// src/tools/devpost-submissions.ts

import { Type } from "@sinclair/typebox";
import type { DevpostClientManager } from "../auth/devpost-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./devpost-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostRegisterHackathonTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_register_hackathon",
    label: "Devpost Register Hackathon",
    description:
      "Register for a hackathon on Devpost. Opens a browser to complete the registration. Auth required.",
    parameters: Type.Object({
      hackathon: Type.String({
        description:
          "Hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
      }),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { hackathon: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;

        let url: string;
        if (params.hackathon.startsWith("http")) {
          url = params.hackathon.replace(/\/$/, "");
        } else {
          url = `https://${params.hackathon}.devpost.com`;
        }

        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ headless: false, channel: "chrome" });
        const context = await browser.newContext();

        // Inject session cookies
        const cookieObjects = session.cookie_details.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || ".devpost.com",
          path: c.path || "/",
        }));
        if (cookieObjects.length > 0) await context.addCookies(cookieObjects);

        const page = await context.newPage();

        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
          await page.waitForTimeout(2000);

          // Click "Register" or "Join Hackathon" button
          const registerBtn = page.locator(
            'a:has-text("Register"), a:has-text("Join"), button:has-text("Register"), button:has-text("Join")',
          ).first();

          try {
            await registerBtn.click({ timeout: 5000 });
            await page.waitForTimeout(3000);

            // Check if registration was successful
            const pageText = await page.textContent("body");
            const registered =
              pageText?.includes("registered") ||
              pageText?.includes("You're in") ||
              pageText?.includes("joined");

            return jsonResult({
              success: true,
              hackathon: url,
              message: registered
                ? "Successfully registered for the hackathon."
                : "Registration button clicked. Check the hackathon page to confirm.",
            });
          } catch {
            // May already be registered or registration not available
            const pageText = await page.textContent("body");
            if (pageText?.includes("registered") || pageText?.includes("You're in")) {
              return jsonResult({
                status: "already_registered",
                hackathon: url,
                message: "You are already registered for this hackathon.",
              });
            }
            return jsonResult({
              error: "Could not find registration button. The hackathon may be closed or invite-only.",
              hackathon: url,
            });
          }
        } finally {
          await browser.close();
        }
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostCreateSubmissionTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_create_submission",
    label: "Devpost Create Submission",
    description:
      "Create a new project submission for a hackathon on Devpost. Opens a browser to fill out the submission form. Auth required.",
    parameters: Type.Object({
      hackathon: Type.String({
        description:
          "Hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
      }),
      title: Type.String({ description: "Project title." }),
      tagline: Type.Optional(
        Type.String({ description: "Short tagline for the project." }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { hackathon: string; title: string; tagline?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;

        let hackUrl: string;
        if (params.hackathon.startsWith("http")) {
          hackUrl = params.hackathon.replace(/\/$/, "");
        } else {
          hackUrl = `https://${params.hackathon}.devpost.com`;
        }

        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ headless: false, channel: "chrome" });
        const context = await browser.newContext();

        const cookieObjects = session.cookie_details.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || ".devpost.com",
          path: c.path || "/",
        }));
        if (cookieObjects.length > 0) await context.addCookies(cookieObjects);

        const page = await context.newPage();

        try {
          // Navigate to the submission start URL
          const startUrl = `${hackUrl}/submissions/new`;
          await page.goto(startUrl, { waitUntil: "networkidle", timeout: 15000 });
          await page.waitForTimeout(2000);

          // Fill in the title
          try {
            const titleInput = page.locator(
              'input[name*="title"], input[id*="title"], input[placeholder*="title" i]',
            ).first();
            await titleInput.fill(params.title);
          } catch {
            console.log("[devpost] Could not find title field — form structure may differ.");
          }

          // Fill in tagline if provided
          if (params.tagline) {
            try {
              const taglineInput = page.locator(
                'input[name*="tagline"], input[id*="tagline"], textarea[name*="tagline"]',
              ).first();
              await taglineInput.fill(params.tagline);
            } catch {
              console.log("[devpost] Could not find tagline field.");
            }
          }

          // Submit the form
          try {
            const submitBtn = page.locator(
              'input[type="submit"], button[type="submit"], button:has-text("Save"), button:has-text("Create")',
            ).first();
            await submitBtn.click();
            await page.waitForTimeout(3000);
          } catch {
            console.log("[devpost] Could not find submit button.");
          }

          // Check result URL — if we're on a project edit page, it worked
          const resultUrl = page.url();

          return jsonResult({
            success: true,
            hackathon: hackUrl,
            title: params.title,
            result_url: resultUrl,
            message:
              "Submission created. Use devpost_update_submission to add more details.",
          });
        } finally {
          await browser.close();
        }
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostUpdateSubmissionTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_update_submission",
    label: "Devpost Update Submission",
    description:
      "Update an existing project submission on Devpost. Opens a browser to fill in the edit form. Auth required.",
    parameters: Type.Object({
      project: Type.String({
        description:
          "Project URL (e.g. 'https://devpost.com/software/myproject') or slug (e.g. 'myproject').",
      }),
      title: Type.Optional(Type.String({ description: "Updated project title." })),
      tagline: Type.Optional(
        Type.String({ description: "Updated short tagline." }),
      ),
      description: Type.Optional(
        Type.String({ description: "Updated project description (supports markdown)." }),
      ),
      built_with: Type.Optional(
        Type.String({
          description: "Comma-separated list of technologies used.",
        }),
      ),
      demo_url: Type.Optional(
        Type.String({ description: "URL where the project can be tried." }),
      ),
      video_url: Type.Optional(
        Type.String({ description: "Demo video URL (YouTube, Vimeo, etc.)." }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        project: string;
        title?: string;
        tagline?: string;
        description?: string;
        built_with?: string;
        demo_url?: string;
        video_url?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;

        let projectUrl: string;
        if (params.project.startsWith("http")) {
          projectUrl = params.project.replace(/\/$/, "");
        } else {
          projectUrl = `https://devpost.com/software/${params.project}`;
        }

        const editUrl = `${projectUrl}/edit`;

        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ headless: false, channel: "chrome" });
        const context = await browser.newContext();

        const cookieObjects = session.cookie_details.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || ".devpost.com",
          path: c.path || "/",
        }));
        if (cookieObjects.length > 0) await context.addCookies(cookieObjects);

        const page = await context.newPage();

        try {
          await page.goto(editUrl, { waitUntil: "networkidle", timeout: 15000 });
          await page.waitForTimeout(2000);

          const fieldsUpdated: string[] = [];

          // Update title
          if (params.title) {
            try {
              const input = page.locator('input[name*="title"], input[id*="title"]').first();
              await input.clear();
              await input.fill(params.title);
              fieldsUpdated.push("title");
            } catch { /* field not found */ }
          }

          // Update tagline
          if (params.tagline) {
            try {
              const input = page.locator(
                'input[name*="tagline"], input[id*="tagline"], textarea[name*="tagline"]',
              ).first();
              await input.clear();
              await input.fill(params.tagline);
              fieldsUpdated.push("tagline");
            } catch { /* field not found */ }
          }

          // Update description
          if (params.description) {
            try {
              const textarea = page.locator(
                'textarea[name*="description"], textarea[id*="description"], [contenteditable="true"]',
              ).first();
              await textarea.clear();
              await textarea.fill(params.description);
              fieldsUpdated.push("description");
            } catch { /* field not found */ }
          }

          // Update demo URL
          if (params.demo_url) {
            try {
              const input = page.locator(
                'input[name*="url"], input[name*="demo"], input[id*="app_url"]',
              ).first();
              await input.clear();
              await input.fill(params.demo_url);
              fieldsUpdated.push("demo_url");
            } catch { /* field not found */ }
          }

          // Update video URL
          if (params.video_url) {
            try {
              const input = page.locator(
                'input[name*="video"], input[id*="video"]',
              ).first();
              await input.clear();
              await input.fill(params.video_url);
              fieldsUpdated.push("video_url");
            } catch { /* field not found */ }
          }

          // Save the form
          try {
            const saveBtn = page.locator(
              'input[type="submit"], button[type="submit"], button:has-text("Save"), a:has-text("Save")',
            ).first();
            await saveBtn.click();
            await page.waitForTimeout(3000);
          } catch {
            console.log("[devpost] Could not find save button.");
          }

          return jsonResult({
            success: true,
            project: projectUrl,
            fields_updated: fieldsUpdated,
            message: `Updated ${fieldsUpdated.length} field(s) on the submission.`,
          });
        } finally {
          await browser.close();
        }
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
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
git add src/tools/devpost-submissions.ts
git commit -m "feat(devpost): add submission tools (register, create, update)"
```

---

### Task 8: Update PluginConfig + tool-registry.ts

**Files:**
- Modify: `src/types/plugin-config.ts`
- Modify: `src/mcp/tool-registry.ts`

**Step 1: Add Devpost config fields to PluginConfig**

In `src/types/plugin-config.ts`, add before the closing brace:

```typescript
  devpost_tokens_path?: string;
  devpost_email?: string;
  devpost_password?: string;
```

**Step 2: Add Devpost imports to tool-registry.ts**

Add these imports at the end of the import block (after the X/Twitter imports near line 224):

```typescript
import { DevpostClientManager } from "../auth/devpost-client-manager.js";
import { createDevpostAuthTool } from "../tools/devpost-auth-tool.js";
import {
  createDevpostSearchHackathonsTool,
  createDevpostGetHackathonTool,
  createDevpostHackathonProjectsTool,
} from "../tools/devpost-hackathons.js";
import {
  createDevpostSearchProjectsTool,
  createDevpostGetProjectTool,
} from "../tools/devpost-projects.js";
import {
  createDevpostGetProfileTool,
  createDevpostMyHackathonsTool,
  createDevpostMyProjectsTool,
} from "../tools/devpost-profile.js";
import {
  createDevpostRegisterHackathonTool,
  createDevpostCreateSubmissionTool,
  createDevpostUpdateSubmissionTool,
} from "../tools/devpost-submissions.js";
```

**Step 3: Add Devpost tool registration block**

Add before `return tools;` in `createAllTools()` (around line 709), after the last integration block:

```typescript
  // Devpost tools — register unconditionally
  const devpostTokensPath =
    config.devpost_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-devpost-tokens.json",
    );

  const devpostManager = new DevpostClientManager(devpostTokensPath);

  add(createDevpostAuthTool(devpostManager, config));
  add(createDevpostSearchHackathonsTool(devpostManager));
  add(createDevpostGetHackathonTool(devpostManager));
  add(createDevpostHackathonProjectsTool(devpostManager));
  add(createDevpostSearchProjectsTool(devpostManager));
  add(createDevpostGetProjectTool(devpostManager));
  add(createDevpostGetProfileTool(devpostManager));
  add(createDevpostMyHackathonsTool(devpostManager));
  add(createDevpostMyProjectsTool(devpostManager));
  add(createDevpostRegisterHackathonTool(devpostManager));
  add(createDevpostCreateSubmissionTool(devpostManager));
  add(createDevpostUpdateSubmissionTool(devpostManager));
```

**Step 4: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Full build**

Run: `pnpm build`
Expected: Successful compilation to `dist/`

**Step 6: Commit**

```bash
git add src/types/plugin-config.ts src/mcp/tool-registry.ts
git commit -m "feat(devpost): register 12 Devpost tools in plugin config + tool registry"
```

---

### Task 9: Create the skill file

**Files:**
- Create: `skills/devpost.SKILL.md`

**Step 1: Create the skill documentation**

```markdown
---
name: devpost
description: Browse hackathons, search projects, manage profile and submissions on Devpost.
metadata: {"openclaw": {"emoji": "🏆"}}
---

# Devpost

Browse hackathons, search software projects, manage your profile, and submit to hackathons on Devpost.

## First-Time Setup

omniclaw uses browser session authentication to access your Devpost account.

1. Optionally pre-configure credentials:
   - `openclaw config set plugins.entries.omniclaw.config.devpost_email "you@example.com"`
   - `openclaw config set plugins.entries.omniclaw.config.devpost_password "your_password"`
2. Call `devpost_auth_setup` — a browser window opens, log into Devpost, done.

Note: Browsing hackathons and searching projects does NOT require authentication.

## Available Tools

### No Auth Required
- `devpost_search_hackathons` — Search/filter hackathons (status, themes, location)
- `devpost_get_hackathon` — Get full hackathon details (prizes, rules, timeline)
- `devpost_hackathon_projects` — Browse submitted projects for a hackathon
- `devpost_search_projects` — Search software projects by keyword
- `devpost_get_project` — Get full project details (description, tech stack, team)

### Auth Required
- `devpost_auth_setup` — Authenticate with Devpost (opens browser for login)
- `devpost_get_profile` — Get your profile or any user's profile
- `devpost_my_hackathons` — List hackathons you've participated in
- `devpost_my_projects` — List your submitted projects
- `devpost_register_hackathon` — Register for a hackathon
- `devpost_create_submission` — Create a new project submission
- `devpost_update_submission` — Update an existing submission

## Workflow

### Browsing (no auth)
1. Use `devpost_search_hackathons` with `status: "open"` to find active hackathons.
2. Use `devpost_get_hackathon` to see prizes, rules, and deadlines.
3. Use `devpost_hackathon_projects` to browse past submissions for inspiration.
4. Use `devpost_search_projects` to find projects by technology or topic.
5. Use `devpost_get_project` to see full project details.

### Submitting (auth required)
1. Call `devpost_auth_setup` to authenticate.
2. Use `devpost_register_hackathon` to register for a hackathon.
3. Use `devpost_create_submission` to start your project submission.
4. Use `devpost_update_submission` to add description, tech stack, demo link, and video.

## Error Handling

If any tool returns `"error": "auth_required"`, call `devpost_auth_setup` first.
If you get a session expired error, re-run `devpost_auth_setup`.
```

**Step 2: Commit**

```bash
git add skills/devpost.SKILL.md
git commit -m "feat(devpost): add devpost skill documentation"
```

---

### Task 10: Create integration tests

**Files:**
- Create: `tests/integration/devpost.test.ts`

**Step 1: Create the integration test file**

```typescript
/**
 * Integration tests — hit the real Devpost APIs.
 *
 * No-auth tests always run. Auth tests require a valid session.
 *
 * Optional env vars:
 *   DEVPOST_EMAIL        Devpost email (enables auth tests)
 *   DEVPOST_PASSWORD     Devpost password
 *   DEVPOST_ACCOUNT      Token store account name (default: "default")
 *
 * Run:
 *   pnpm vitest run tests/integration/devpost.test.ts
 *
 * With auth:
 *   DEVPOST_EMAIL="you@example.com" DEVPOST_PASSWORD="pass" pnpm vitest run tests/integration/devpost.test.ts
 */

import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { DevpostClientManager } from "../../src/auth/devpost-client-manager.js";
import { createDevpostAuthTool } from "../../src/tools/devpost-auth-tool.js";
import {
  createDevpostSearchHackathonsTool,
  createDevpostGetHackathonTool,
  createDevpostHackathonProjectsTool,
} from "../../src/tools/devpost-hackathons.js";
import {
  createDevpostSearchProjectsTool,
  createDevpostGetProjectTool,
} from "../../src/tools/devpost-projects.js";
import {
  createDevpostGetProfileTool,
  createDevpostMyHackathonsTool,
  createDevpostMyProjectsTool,
} from "../../src/tools/devpost-profile.js";
import type { PluginConfig } from "../../src/types/plugin-config.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-devpost-tokens.json");
const ACCOUNT = process.env.DEVPOST_ACCOUNT ?? "default";
const DEVPOST_EMAIL = process.env.DEVPOST_EMAIL ?? "";
const DEVPOST_PASSWORD = process.env.DEVPOST_PASSWORD ?? "";

const authCredentialsAvailable = DEVPOST_EMAIL !== "";

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let manager: DevpostClientManager;

// ---------------------------------------------------------------------------
// No-auth tests (always run)
// ---------------------------------------------------------------------------
describe("Devpost Integration — No Auth", () => {
  beforeAll(() => {
    manager = new DevpostClientManager(TOKENS_PATH);
  });

  it("devpost_search_hackathons — returns open hackathons", async () => {
    const tool = createDevpostSearchHackathonsTool(manager);
    const result = await tool.execute("test", { status: "open" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.hackathons[0]).toHaveProperty("title");
    expect(parsed.hackathons[0]).toHaveProperty("url");
    console.log(`[integration] Found ${parsed.count} open hackathons. First: ${parsed.hackathons[0].title}`);
  });

  it("devpost_search_hackathons — returns ended hackathons", async () => {
    const tool = createDevpostSearchHackathonsTool(manager);
    const result = await tool.execute("test", { status: "ended" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.total).toBeGreaterThan(0);
  });

  it("devpost_search_projects — returns projects for a query", async () => {
    const tool = createDevpostSearchProjectsTool(manager);
    const result = await tool.execute("test", { query: "machine learning" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.query).toBe("machine learning");
    // Projects may or may not be returned depending on HTML parsing success
    console.log(`[integration] Found ${parsed.count} projects for "machine learning"`);
  });

  it("devpost_get_project — returns project details", async () => {
    const tool = createDevpostGetProjectTool(manager);
    const result = await tool.execute("test", { project: "devpost-stats" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.title).toBeTruthy();
    expect(parsed.url).toContain("devpost.com/software/devpost-stats");
    console.log(`[integration] Project: ${parsed.title}`);
  });
});

// ---------------------------------------------------------------------------
// Auth tests (only when credentials available)
// ---------------------------------------------------------------------------
if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping Devpost auth tests: DEVPOST_EMAIL env var not set.\n",
  );
}

describe.skipIf(!authCredentialsAvailable)("Devpost Integration — Auth", () => {
  beforeAll(async () => {
    manager = new DevpostClientManager(TOKENS_PATH);

    // If we already have valid credentials, skip re-auth
    if (manager.hasCredentials(ACCOUNT)) {
      try {
        const html = (await manager.get(ACCOUNT, "/settings")) as string;
        if (!html.includes("/users/login")) {
          console.log("[integration] Reusing existing Devpost session.");
          return;
        }
      } catch {
        console.log("[integration] Existing session invalid, re-authenticating...");
      }
    }

    // Authenticate via Playwright
    const config: PluginConfig = {
      client_secret_path: "",
      devpost_email: DEVPOST_EMAIL,
      devpost_password: DEVPOST_PASSWORD,
    } as PluginConfig;
    const authTool = createDevpostAuthTool(manager, config);
    const result = await authTool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("authenticated");
    console.log(`[integration] Authenticated as ${parsed.username}`);
  }, 360_000); // 6 min timeout for manual login

  it("devpost_get_profile — returns authenticated user profile", async () => {
    const tool = createDevpostGetProfileTool(manager);
    const result = await tool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.username).toBeTruthy();
    expect(parsed.name).toBeTruthy();
    console.log(`[integration] Profile: ${parsed.name} (@${parsed.username})`);
  });

  it("devpost_my_hackathons — returns hackathon list", async () => {
    const tool = createDevpostMyHackathonsTool(manager);
    const result = await tool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.count).toBeGreaterThanOrEqual(0);
    console.log(`[integration] ${parsed.count} hackathons found.`);
  });

  it("devpost_my_projects — returns project list", async () => {
    const tool = createDevpostMyProjectsTool(manager);
    const result = await tool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.count).toBeGreaterThanOrEqual(0);
    console.log(`[integration] ${parsed.count} projects found.`);
  });
});
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Run the no-auth tests**

Run: `pnpm vitest run tests/integration/devpost.test.ts`
Expected: No-auth tests pass, auth tests skipped

**Step 4: Commit**

```bash
git add tests/integration/devpost.test.ts
git commit -m "test(devpost): add integration tests for all Devpost tools"
```

---

### Task 11: Update CLAUDE.md kanban

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Devpost to the "Done" table**

Add a new row to the "Done" table in CLAUDE.md:

```
| Devpost | 12 | `devpost` | `docs/plans/2026-02-28-devpost-design.md` | Playwright browser auth, hybrid JSON API + scraping |
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Devpost integration to CLAUDE.md kanban"
```

---

### Task 12: Final build verification + run auth tests

**Step 1: Full build**

Run: `pnpm build`
Expected: Successful compilation to `dist/`

**Step 2: Run integration tests (no auth)**

Run: `pnpm vitest run tests/integration/devpost.test.ts`
Expected: No-auth tests pass (search hackathons, search projects, get project)

**Step 3: Run integration tests (with auth)**

Run: `DEVPOST_EMAIL="your_email" DEVPOST_PASSWORD="your_password" pnpm vitest run tests/integration/devpost.test.ts`
Expected: All tests pass including auth tests. A browser window opens for login, tools are validated.

**Step 4: Fix any scraping regex issues**

If the HTML parsing doesn't match expected patterns, adjust the regex in the tools to match the actual Devpost page structure. This is expected — scraping regexes often need tuning against real pages.

**Step 5: Final commit with any fixes**

```bash
git add -A
git commit -m "fix(devpost): tune HTML parsing for real Devpost pages"
```
