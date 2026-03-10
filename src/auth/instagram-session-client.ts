import type { SessionStore, SessionData } from "./session-store.js";

export class InstagramSessionClient {
  private session: SessionData | null = null;

  constructor(
    private sessionStore: SessionStore,
    private account: string = "default",
    private baseUrl: string = "https://i.instagram.com/api/v1",
  ) {
    this.session = sessionStore.get(account) ?? null;
  }

  isAuthenticated(): boolean {
    return this.session !== null && !!this.session.cookies["sessionid"];
  }

  /** Get the authenticated user's numeric ID from the ds_user_id cookie. */
  getUserId(): string | null {
    return this.session?.cookies["ds_user_id"] ?? null;
  }

  reload(account?: string): void {
    this.session = this.sessionStore.get(account ?? this.account) ?? null;
  }

  /**
   * Update the CSRF token if the response contains a new csrftoken in Set-Cookie.
   * Instagram rotates csrftoken on every response.
   */
  private updateCsrfFromResponse(res: Response): void {
    if (!this.session) return;

    const setCookieHeader = res.headers.get("set-cookie");
    if (!setCookieHeader) return;

    const match = setCookieHeader.match(/csrftoken=([^;]+)/);
    if (match && match[1] !== this.session.cookies["csrftoken"]) {
      this.session.cookies["csrftoken"] = match[1];
      this.session.csrfToken = match[1];
      this.sessionStore.set(this.account, this.session);
    }
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
      "X-IG-App-ID": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "https://www.instagram.com",
      Referer: "https://www.instagram.com/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      ...(this.session.csrfToken ? { "X-CSRFToken": this.session.csrfToken } : {}),
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

    // Update CSRF token from response before checking status
    this.updateCsrfFromResponse(res);

    if (res.status === 401 || res.status === 403) {
      throw new Error("session_expired");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`instagram_api_error: ${res.status} ${text.slice(0, 200)}`);
    }

    return res.json() as Promise<T>;
  }
}
