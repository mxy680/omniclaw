import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface SessionData {
  cookies: Record<string, string>;
  csrfToken?: string;
  userAgent: string;
  capturedAt: number;
  [key: string]: unknown;
}

interface SessionFile {
  [account: string]: SessionData;
}

export class SessionStore {
  constructor(private sessionsPath: string) {}

  private load(): SessionFile {
    if (!existsSync(this.sessionsPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.sessionsPath, "utf-8")) as SessionFile;
    } catch {
      return {};
    }
  }

  private save(data: SessionFile): void {
    const dir = dirname(this.sessionsPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.sessionsPath, JSON.stringify(data, null, 2), "utf-8");
  }

  get(account: string): SessionData | null {
    const data = this.load();
    return data[account] ?? null;
  }

  set(account: string, session: SessionData): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  has(account: string): boolean {
    return this.get(account) !== null;
  }

  delete(account: string): boolean {
    const data = this.load();
    if (!(account in data)) return false;
    delete data[account];
    this.save(data);
    return true;
  }

  list(): string[] {
    return Object.keys(this.load());
  }
}
