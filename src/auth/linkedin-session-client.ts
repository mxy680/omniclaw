import type { SessionStore, SessionData } from "./session-store.js";

export class LinkedinSessionClient {
  private session: SessionData | null = null;

  constructor(
    private sessionStore: SessionStore,
    private account: string = "default",
    private baseUrl: string = "https://www.linkedin.com/voyager/api",
  ) {
    this.session = sessionStore.get(account) ?? null;
  }

  isAuthenticated(): boolean {
    return this.session !== null;
  }

  reload(account?: string): void {
    this.session = this.sessionStore.get(account ?? this.account) ?? null;
  }

  async request<T = unknown>(opts: {
    method?: string;
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<T> {
    if (!this.session) throw new Error("not_authenticated");

    const cookieHeader = Object.entries(this.session.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const headers: Record<string, string> = {
      Cookie: cookieHeader,
      "User-Agent": this.session.userAgent,
      "X-Restli-Protocol-Version": "2.0.0",
      ...(this.session.csrfToken ? { "Csrf-Token": this.session.csrfToken } : {}),
      ...opts.headers,
    };

    if (opts.body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${this.baseUrl}${opts.path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("session_expired");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`linkedin_api_error: ${res.status} ${text.slice(0, 200)}`);
    }

    return res.json() as Promise<T>;
  }
}
