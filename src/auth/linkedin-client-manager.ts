import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface LinkedInSession {
  li_at: string;
  jsessionid: string;
  csrf_token: string;
  all_cookies: Record<string, string>;
  cookie_details: Array<{ name: string; value: string; domain: string; path: string }>;
}

interface LinkedInSessionFile {
  [account: string]: LinkedInSession;
}

export class LinkedInClientManager {
  constructor(private tokensPath: string) {}

  private load(): LinkedInSessionFile {
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as LinkedInSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: LinkedInSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: LinkedInSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): LinkedInSession | null {
    const data = this.load();
    return data[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const session = this.getCredentials(account);
    return session !== null && session.li_at !== "";
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  private buildCookieString(session: LinkedInSession): string {
    if (Object.keys(session.all_cookies).length > 0) {
      return Object.entries(session.all_cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    }
    return `li_at=${session.li_at}; JSESSIONID="${session.jsessionid}"`;
  }

  async get(
    account: string,
    path: string,
    params?: Record<string, string>,
    rawQs?: string,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    let url = `https://www.linkedin.com/voyager/api/${path}`;
    const searchParams = new URLSearchParams(params ?? {});
    const qs = searchParams.toString();
    const parts = [qs, rawQs].filter(Boolean).join("&");
    if (parts) {
      url += `?${parts}`;
    }

    const cookieStr = this.buildCookieString(session);
    const headers: Record<string, string> = {
      Cookie: cookieStr,
      "Csrf-Token": session.csrf_token,
      "X-Restli-Protocol-Version": "2.0.0",
      "X-Li-Lang": "en_US",
      Accept: "application/vnd.linkedin.normalized+json+2.1",
    };

    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();

      // Inject cookies into browser context
      const cookieObjects = session.cookie_details.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || ".linkedin.com",
        path: c.path || "/",
      }));
      if (cookieObjects.length > 0) {
        await context.addCookies(cookieObjects);
      }

      const page = await context.newPage();
      await page.goto("https://www.linkedin.com", { waitUntil: "domcontentloaded" });

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
        throw new Error("LinkedIn session expired. Call linkedin_auth_setup again.");
      }
      if (result.status === 429) {
        throw new Error("LinkedIn API rate limit exceeded. Please wait before retrying.");
      }
      if (result.status >= 400) {
        throw new Error(`LinkedIn API error: ${result.status} ${result.statusText}`);
      }

      // Update cookies from Set-Cookie header
      if (result.setCookie) {
        this.updateCookiesFromHeader(account, result.setCookie);
      }

      return JSON.parse(result.body);
    } catch (err) {
      await browser.close().catch(() => {});
      throw err;
    }
  }

  async getPaginated(
    account: string,
    path: string,
    count: number = 10,
    maxPages: number = 3,
    params?: Record<string, string>,
    rawQs?: string,
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    let start = 0;

    for (let page = 0; page < maxPages; page++) {
      const pageParams = { ...params, start: String(start), count: String(count) };
      const data = (await this.get(account, path, pageParams, rawQs)) as {
        data?: unknown;
        included?: unknown[];
        paging?: { total?: number; start?: number; count?: number };
      };

      if (data.included) {
        results.push(...data.included);
      } else if (data.data) {
        results.push(data.data);
      }

      const total = data.paging?.total ?? 0;
      start += count;
      if (start >= total) break;
    }

    return results;
  }

  extractEntities(data: { included?: Array<Record<string, unknown>> }, entityType: string): Array<Record<string, unknown>> {
    if (!data.included || !Array.isArray(data.included)) return [];
    return data.included.filter(
      (item) => typeof item.$type === "string" && (item.$type as string).endsWith(entityType),
    );
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
