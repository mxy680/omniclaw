import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface CanvasSession {
  base_url: string;
  canvas_session: string;
  _csrf_token: string;
  log_session_id: string;
  csrf_meta_token: string;
  all_cookies: Record<string, string>;
}

interface CanvasSessionFile {
  [account: string]: CanvasSession;
}

export class CanvasClientManager {
  constructor(private tokensPath: string) {}

  private load(): CanvasSessionFile {
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as CanvasSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: CanvasSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: CanvasSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  /**
   * Bootstrap a session from just a canvas_session cookie value.
   * Useful for integration tests where you grab the cookie from browser devtools.
   */
  setSessionFromCookie(account: string, base_url: string, sessionCookie: string): void {
    this.setCredentials(account, {
      base_url: base_url.replace(/\/$/, ""),
      canvas_session: sessionCookie,
      _csrf_token: "",
      log_session_id: "",
      csrf_meta_token: "",
      all_cookies: { canvas_session: sessionCookie },
    });
  }

  getCredentials(account: string): CanvasSession | null {
    const data = this.load();
    return data[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const session = this.getCredentials(account);
    return session !== null && session.canvas_session !== "";
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  private buildHeaders(session: CanvasSession): Record<string, string> {
    const allCookies = session.all_cookies;
    const cookieStr =
      Object.keys(allCookies).length > 0
        ? Object.entries(allCookies)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ")
        : `canvas_session=${session.canvas_session}`;

    const headers: Record<string, string> = {
      Cookie: cookieStr,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    };

    const csrf = session.csrf_meta_token || decodeURIComponent(session._csrf_token || "");
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }

    return headers;
  }

  async get(
    account: string,
    path: string,
    params?: Record<string, string | string[]>,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const url = new URL(`${session.base_url}/api/v1/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(key, v);
          }
        } else {
          url.searchParams.set(key, value);
        }
      }
    }

    const res = await fetch(url.toString(), {
      headers: this.buildHeaders(session),
    });

    if (res.status === 401) {
      throw new Error("Canvas session expired. Call canvas_auth_setup again.");
    }
    if (res.status === 429) {
      throw new Error("Canvas API rate limit exceeded. Please wait before retrying.");
    }
    if (res.status >= 400) {
      throw new Error(`Canvas API error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  async getPaginated(
    account: string,
    path: string,
    params?: Record<string, string | string[]>,
    maxPages = 10,
  ): Promise<unknown[]> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const results: unknown[] = [];
    const headers = this.buildHeaders(session);

    const firstUrl = new URL(`${session.base_url}/api/v1/${path}`);
    firstUrl.searchParams.set("per_page", "100");
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            firstUrl.searchParams.append(key, v);
          }
        } else {
          firstUrl.searchParams.set(key, value);
        }
      }
    }

    let nextUrl: string | null = firstUrl.toString();
    let page = 0;

    while (nextUrl && page < maxPages) {
      const res = await fetch(nextUrl, { headers });

      if (res.status === 401) {
        throw new Error("Canvas session expired. Call canvas_auth_setup again.");
      }
      if (res.status === 429) {
        throw new Error("Canvas API rate limit exceeded. Please wait before retrying.");
      }
      if (res.status >= 400) {
        throw new Error(`Canvas API error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as unknown[];
      results.push(...data);

      // Follow Link: rel="next" header
      const linkHeader = res.headers.get("Link");
      nextUrl = extractNextLink(linkHeader);
      page++;
    }

    return results;
  }
}

function extractNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}
