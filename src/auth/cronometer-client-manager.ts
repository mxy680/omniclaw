import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface CronometerSession {
  sesnonce: string;
  user_id: string;
  auth_token: string; // for export API
  gwt_permutation: string;
  gwt_header: string;
  gwt_content_type: string; // "text/x-gwt-rpc; charset=UTF-8"
  gwt_module_base: string; // "https://cronometer.com/cronometer/"
  all_cookies: Record<string, string>;
  authenticated_at: number; // Unix timestamp (ms)
}

interface CronometerSessionFile {
  [account: string]: CronometerSession;
}

const CRONOMETER_BASE = "https://cronometer.com";

export class CronometerClientManager {
  constructor(private tokensPath: string) {}

  private load(): CronometerSessionFile {
    if (!existsSync(this.tokensPath)) return {};
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as CronometerSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: CronometerSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: CronometerSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): CronometerSession | null {
    return this.load()[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    return this.getCredentials(account) !== null;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  private getCookieHeader(session: CronometerSession): string {
    return Object.entries(session.all_cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  /**
   * GET https://cronometer.com/export with the given generate type and date range.
   * Returns raw CSV string.
   */
  async export(
    account: string,
    generate: "dailySummary" | "servings" | "exercises" | "biometrics" | "notes",
    start: string, // YYYY-MM-DD
    end: string,   // YYYY-MM-DD
  ): Promise<string> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const params = new URLSearchParams({
      nonce: session.auth_token,
      generate,
      start,
      end,
    });

    const resp = await fetch(`${CRONOMETER_BASE}/export?${params}`, {
      method: "GET",
      headers: {
        Cookie: this.getCookieHeader(session),
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Cronometer session expired. Call cronometer_auth_setup to re-authenticate.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Cronometer export error: ${resp.status} — ${text.slice(0, 500)}`);
    }

    return resp.text();
  }

  /**
   * POST a GWT RPC call to https://cronometer.com/cronometer/app.
   * Returns the raw response text for the caller to parse.
   */
  async gwtCall(account: string, body: string): Promise<string> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const resp = await fetch(`${CRONOMETER_BASE}/cronometer/app`, {
      method: "POST",
      headers: {
        "Content-Type": session.gwt_content_type,
        "X-GWT-Module-Base": session.gwt_module_base,
        "X-GWT-Permutation": session.gwt_permutation,
        Cookie: this.getCookieHeader(session),
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body,
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Cronometer session expired. Call cronometer_auth_setup to re-authenticate.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Cronometer GWT error: ${resp.status} — ${text.slice(0, 500)}`);
    }

    return resp.text();
  }
}
