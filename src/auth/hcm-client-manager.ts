import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface HcmCookieDetail {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  expires?: number;
}

export interface HcmSession {
  cookies: Record<string, string>;
  cookie_details: HcmCookieDetail[];
  employee_name: string;
}

interface HcmSessionFile {
  [account: string]: HcmSession;
}

export const HCM_BASE_URL = "https://hcm.case.edu";

export class HcmClientManager {
  constructor(private tokensPath: string) {}

  private load(): HcmSessionFile {
    if (!existsSync(this.tokensPath)) return {};
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as HcmSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: HcmSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: HcmSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): HcmSession | null {
    return this.load()[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const session = this.getCredentials(account);
    return session !== null && Object.keys(session.cookies).length > 0;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }
}
