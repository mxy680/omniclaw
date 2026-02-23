import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { GoogleGenAI } from "@google/genai";

interface GeminiKeyFile {
  [account: string]: { apiKey: string };
}

export class GeminiClientManager {
  private clients = new Map<string, GoogleGenAI>();

  constructor(private keysPath: string) {}

  private load(): GeminiKeyFile {
    if (!existsSync(this.keysPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.keysPath, "utf-8")) as GeminiKeyFile;
    } catch {
      return {};
    }
  }

  private save(data: GeminiKeyFile): void {
    const dir = dirname(this.keysPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.keysPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setKey(account: string, apiKey: string): void {
    const data = this.load();
    data[account] = { apiKey };
    this.save(data);
    this.clients.delete(account);
  }

  getKey(account: string): string | null {
    const data = this.load();
    return data[account]?.apiKey ?? null;
  }

  hasKey(account: string): boolean {
    return this.getKey(account) !== null;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  getClient(account: string): GoogleGenAI {
    const cached = this.clients.get(account);
    if (cached) return cached;

    const apiKey = this.getKey(account);
    if (!apiKey) {
      throw new Error(
        "No Gemini API key for account: " + account + ". Call gemini_auth_setup first.",
      );
    }

    const client = new GoogleGenAI({ apiKey });
    this.clients.set(account, client);
    return client;
  }
}
