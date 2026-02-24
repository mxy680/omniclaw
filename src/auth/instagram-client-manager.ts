import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface InstagramSession {
  sessionid: string;
  csrftoken: string;
  ds_user_id: string;
  ig_did: string;
  mid: string;
  all_cookies: Record<string, string>;
  cookie_details: Array<{ name: string; value: string; domain: string; path: string }>;
}

interface InstagramSessionFile {
  [account: string]: InstagramSession;
}

export class InstagramClientManager {
  private usernameCache = new Map<string, string>();

  constructor(private tokensPath: string) {}

  private load(): InstagramSessionFile {
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as InstagramSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: InstagramSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: InstagramSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): InstagramSession | null {
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

  private buildCookieString(session: InstagramSession): string {
    if (Object.keys(session.all_cookies).length > 0) {
      return Object.entries(session.all_cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    }
    return `sessionid=${session.sessionid}; csrftoken=${session.csrftoken}; ds_user_id=${session.ds_user_id}`;
  }

  async get(
    account: string,
    path: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    let url = `https://www.instagram.com/api/v1/${path}`;
    const searchParams = new URLSearchParams(params ?? {});
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }

    const cookieStr = this.buildCookieString(session);
    const headers: Record<string, string> = {
      Cookie: cookieStr,
      "X-CSRFToken": session.csrftoken,
      "X-IG-App-ID": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "*/*",
    };

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();

      const cookieObjects = session.cookie_details.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || ".instagram.com",
        path: c.path || "/",
      }));
      if (cookieObjects.length > 0) {
        await context.addCookies(cookieObjects);
      }

      const page = await context.newPage();
      await page.goto("https://www.instagram.com", { waitUntil: "domcontentloaded" });

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

      if (result.status === 401) {
        throw new Error("Instagram session expired. Call instagram_auth_setup again.");
      }
      if (result.status === 429) {
        throw new Error("Instagram API rate limit exceeded. Please wait before retrying.");
      }
      if (result.status >= 400) {
        throw new Error(`Instagram API error: ${result.status} ${result.statusText}`);
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

  async post(
    account: string,
    path: string,
    body?: Record<string, string>,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const url = `https://www.instagram.com/api/v1/${path}`;

    const cookieStr = this.buildCookieString(session);
    const headers: Record<string, string> = {
      Cookie: cookieStr,
      "X-CSRFToken": session.csrftoken,
      "X-IG-App-ID": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
    };

    const formBody = new URLSearchParams(body ?? {}).toString();

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();

      const cookieObjects = session.cookie_details.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || ".instagram.com",
        path: c.path || "/",
      }));
      if (cookieObjects.length > 0) {
        await context.addCookies(cookieObjects);
      }

      const page = await context.newPage();
      await page.goto("https://www.instagram.com", { waitUntil: "domcontentloaded" });

      const result = await page.evaluate(
        async ({ fetchUrl, fetchHeaders, fetchBody }) => {
          const resp = await fetch(fetchUrl, {
            method: "POST",
            headers: fetchHeaders,
            body: fetchBody,
            credentials: "include",
          });
          const responseBody = await resp.text();
          const setCookieHeader = resp.headers.get("set-cookie") ?? "";
          return {
            status: resp.status,
            statusText: resp.statusText,
            body: responseBody,
            setCookie: setCookieHeader,
          };
        },
        { fetchUrl: url, fetchHeaders: headers, fetchBody: formBody },
      );

      await browser.close();

      if (result.status === 401) {
        throw new Error("Instagram session expired. Call instagram_auth_setup again.");
      }
      if (result.status === 429) {
        throw new Error("Instagram API rate limit exceeded. Please wait before retrying.");
      }
      if (result.status >= 400) {
        throw new Error(`Instagram API error: ${result.status} ${result.statusText}`);
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

  async resolveUsername(account: string, username: string): Promise<string> {
    const cached = this.usernameCache.get(username);
    if (cached) return cached;

    const data = (await this.get(account, `users/web_profile_info/?username=${encodeURIComponent(username)}`)) as {
      data?: { user?: { pk?: string | number; id?: string | number } };
    };

    const pk = String(data?.data?.user?.pk ?? data?.data?.user?.id ?? "");
    if (!pk) throw new Error(`Could not resolve username "${username}" to a user ID.`);

    this.usernameCache.set(username, pk);
    return pk;
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
