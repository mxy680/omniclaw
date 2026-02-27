import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

interface VercelTokenFile {
  [account: string]: { token: string };
}

export class VercelClientManager {
  private static readonly BASE_URL = "https://api.vercel.com";

  constructor(private tokensPath: string) {}

  private load(): VercelTokenFile {
    if (!existsSync(this.tokensPath)) return {};
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as VercelTokenFile;
    } catch {
      return {};
    }
  }

  private save(data: VercelTokenFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setToken(account: string, token: string): void {
    const data = this.load();
    data[account] = { token };
    this.save(data);
  }

  getToken(account: string): string | null {
    return this.load()[account]?.token ?? null;
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
      "Content-Type": "application/json",
    };
  }

  private resolveToken(account: string): string {
    const token = this.getToken(account);
    if (!token)
      throw new Error(
        "No Vercel token for account: " + account + ". Call vercel_auth_setup first.",
      );
    return token;
  }

  private handleError(res: Response): never {
    if (res.status === 401) {
      throw new Error(
        "Vercel token is invalid or expired. Call vercel_auth_setup with a new token.",
      );
    }
    if (res.status === 403) {
      throw new Error(
        "Vercel API forbidden — possible rate limit or insufficient token permissions.",
      );
    }
    if (res.status === 404) {
      throw new Error("Vercel resource not found (404). Check the project, deployment, or domain.");
    }
    throw new Error(`Vercel API error: ${res.status} ${res.statusText}`);
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${VercelClientManager.BASE_URL}/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  async get(
    account: string,
    path: string,
    params?: Record<string, string>,
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
      headers: this.buildHeaders(token),
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
      headers: this.buildHeaders(token),
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
}
