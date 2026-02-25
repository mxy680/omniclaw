import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

interface BlueBubblesConfig {
  url: string;
  password: string;
}

interface BlueBubblesKeyFile {
  [account: string]: BlueBubblesConfig;
}

export class BlueBubblesClientManager {
  constructor(private keysPath: string) {}

  private load(): BlueBubblesKeyFile {
    if (!existsSync(this.keysPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.keysPath, "utf-8")) as BlueBubblesKeyFile;
    } catch {
      return {};
    }
  }

  private save(data: BlueBubblesKeyFile): void {
    const dir = dirname(this.keysPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.keysPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setConfig(account: string, url: string, password: string): void {
    const data = this.load();
    // Normalize URL: strip trailing slash
    data[account] = { url: url.replace(/\/+$/, ""), password };
    this.save(data);
  }

  getConfig(account: string): BlueBubblesConfig | null {
    const data = this.load();
    return data[account] ?? null;
  }

  hasConfig(account: string): boolean {
    return this.getConfig(account) !== null;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  /**
   * Make a GET request to the BlueBubbles API.
   * The password is automatically appended as a query parameter.
   */
  async get(
    account: string,
    apiPath: string,
    params?: Record<string, string | number>,
  ): Promise<unknown> {
    const config = this.getConfig(account);
    if (!config) {
      throw new Error(
        "No BlueBubbles config for account: " + account + ". Call imessage_bb_auth_setup first.",
      );
    }

    const url = new URL(apiPath, config.url);
    url.searchParams.set("password", config.password);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`BlueBubbles API error ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  /**
   * Make a POST request to the BlueBubbles API.
   * The password is automatically appended as a query parameter.
   */
  async post(
    account: string,
    apiPath: string,
    body: unknown,
  ): Promise<unknown> {
    const config = this.getConfig(account);
    if (!config) {
      throw new Error(
        "No BlueBubbles config for account: " + account + ". Call imessage_bb_auth_setup first.",
      );
    }

    const url = new URL(apiPath, config.url);
    url.searchParams.set("password", config.password);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`BlueBubbles API error ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }
}
