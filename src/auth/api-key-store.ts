import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

interface ApiKeyFile {
  [account: string]: string;
}

export class ApiKeyStore {
  constructor(private storePath: string) {}

  private load(): ApiKeyFile {
    if (!existsSync(this.storePath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.storePath, "utf-8")) as ApiKeyFile;
    } catch {
      return {};
    }
  }

  private save(data: ApiKeyFile): void {
    const dir = dirname(this.storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.storePath, JSON.stringify(data, null, 2), "utf-8");
  }

  get(account: string): string | null {
    const data = this.load();
    return data[account] ?? null;
  }

  set(account: string, key: string): void {
    const data = this.load();
    data[account] = key;
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

  /**
   * Migrate a legacy single key into the store under "default".
   * No-op if the store already has accounts or the legacy key is empty.
   */
  migrateFromConfig(legacyKey: string | undefined): void {
    if (!legacyKey) return;
    if (this.list().length > 0) return;
    this.set("default", legacyKey);
  }
}
