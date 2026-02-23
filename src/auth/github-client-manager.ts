import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

interface GitHubTokenFile {
  [account: string]: { token: string };
}

export class GitHubClientManager {
  private static readonly BASE_URL = "https://api.github.com";

  constructor(private tokensPath: string) {}

  private load(): GitHubTokenFile {
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as GitHubTokenFile;
    } catch {
      return {};
    }
  }

  private save(data: GitHubTokenFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setToken(account: string, token: string): void {
    const data = this.load();
    data[account] = { token };
    this.save(data);
  }

  getToken(account: string): string | null {
    const data = this.load();
    return data[account]?.token ?? null;
  }

  hasToken(account: string): boolean {
    return this.getToken(account) !== null;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  private buildHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private resolveToken(account: string): string {
    const token = this.getToken(account);
    if (!token)
      throw new Error(
        "No GitHub token for account: " + account + ". Call github_auth_setup first.",
      );
    return token;
  }

  private handleError(res: Response): never {
    if (res.status === 401) {
      throw new Error(
        "GitHub token is invalid or expired. Call github_auth_setup with a new token.",
      );
    }
    if (res.status === 403) {
      throw new Error(
        "GitHub API forbidden — possible rate limit or insufficient token permissions.",
      );
    }
    if (res.status === 404) {
      throw new Error("GitHub resource not found (404). Check the owner, repo, or resource ID.");
    }
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  private buildUrl(path: string, params?: Record<string, string | string[]>): string {
    const url = new URL(`${GitHubClientManager.BASE_URL}/${path}`);
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
    return url.toString();
  }

  async get(
    account: string,
    path: string,
    params?: Record<string, string | string[]>,
  ): Promise<unknown> {
    const token = this.resolveToken(account);
    const url = this.buildUrl(path, params);

    const res = await fetch(url, { headers: this.buildHeaders(token) });
    if (!res.ok) this.handleError(res);
    return res.json();
  }

  async post(account: string, path: string, body?: unknown): Promise<unknown> {
    const token = this.resolveToken(account);
    const url = this.buildUrl(path);

    const res = await fetch(url, {
      method: "POST",
      headers: { ...this.buildHeaders(token), "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) this.handleError(res);
    return res.json();
  }

  async patch(account: string, path: string, body?: unknown): Promise<unknown> {
    const token = this.resolveToken(account);
    const url = this.buildUrl(path);

    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...this.buildHeaders(token), "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) this.handleError(res);
    // Some PATCH endpoints return 204 No Content
    if (res.status === 204) return { status: "ok" };
    return res.json();
  }

  async put(account: string, path: string, body?: unknown): Promise<unknown> {
    const token = this.resolveToken(account);
    const url = this.buildUrl(path);

    const res = await fetch(url, {
      method: "PUT",
      headers: { ...this.buildHeaders(token), "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) this.handleError(res);
    if (res.status === 204) return { status: "ok" };
    return res.json();
  }

  async delete(account: string, path: string): Promise<unknown> {
    const token = this.resolveToken(account);
    const url = this.buildUrl(path);

    const res = await fetch(url, {
      method: "DELETE",
      headers: this.buildHeaders(token),
    });
    if (!res.ok) this.handleError(res);
    if (res.status === 204) return { status: "ok" };
    return res.json();
  }

  async getPaginated(
    account: string,
    path: string,
    params?: Record<string, string | string[]>,
    maxPages = 10,
  ): Promise<unknown[]> {
    const token = this.resolveToken(account);
    const headers = this.buildHeaders(token);

    const firstUrl = this.buildUrl(path, params);
    let nextUrl: string | null = firstUrl;
    let page = 0;
    const results: unknown[] = [];

    while (nextUrl && page < maxPages) {
      const res = await fetch(nextUrl, { headers });
      if (!res.ok) this.handleError(res);

      const data = (await res.json()) as unknown[];
      results.push(...data);

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
