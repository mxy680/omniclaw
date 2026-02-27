import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface SlackSession {
  xoxc_token: string;
  d_cookie: string;
  team_id: string;
  team_name: string;
  user_id: string;
  all_cookies: Record<string, string>;
}

interface SlackSessionFile {
  [account: string]: SlackSession;
}

const API_BASE = "https://slack.com/api";

export class SlackClientManager {
  constructor(private tokensPath: string) {}

  private load(): SlackSessionFile {
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as SlackSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: SlackSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: SlackSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): SlackSession | null {
    const data = this.load();
    return data[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const session = this.getCredentials(account);
    return session !== null && session.xoxc_token !== "";
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  /**
   * Makes a POST request to the Slack Web API.
   *
   * Slack's Web API uses POST with `application/x-www-form-urlencoded` body.
   * Auth is via `Authorization: Bearer xoxc-...` + `Cookie: d=xoxd-...`.
   */
  async post(
    account: string,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const url = `${API_BASE}/${method}`;

    const body = new URLSearchParams();
    body.set("token", session.xoxc_token);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          body.set(key, String(value));
        }
      }
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.xoxc_token}`,
        Cookie: `d=${session.d_cookie}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body: body.toString(),
    });

    if (resp.status === 429) {
      const retryAfter = resp.headers.get("Retry-After") ?? "unknown";
      throw new Error(`Slack API rate limit exceeded. Retry after ${retryAfter}s.`);
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Slack API HTTP error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`);
    }

    const data = (await resp.json()) as { ok: boolean; error?: string };

    if (!data.ok) {
      if (data.error === "token_revoked" || data.error === "invalid_auth" || data.error === "not_authed") {
        throw new Error(`Slack session expired (${data.error}). Call slack_auth_setup to re-authenticate.`);
      }
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  }
}
