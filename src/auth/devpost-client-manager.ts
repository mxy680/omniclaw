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

  private buildCookieHeader(session: DevpostSession): string {
    return Object.entries(session.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

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
