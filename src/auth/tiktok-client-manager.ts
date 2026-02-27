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
