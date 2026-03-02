import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { Credentials } from "google-auth-library";

interface TokenFile {
  [account: string]: Credentials;
}

export class TokenStore {
  constructor(private tokensPath: string) {}

  private load(): TokenFile {
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as TokenFile;
    } catch {
      return {};
    }
  }

  private save(data: TokenFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  get(account: string): Credentials | null {
    const data = this.load();
    return data[account] ?? null;
  }

  set(account: string, tokens: Credentials): void {
    const data = this.load();
    data[account] = tokens;
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
