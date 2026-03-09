import type { ApiKeyStore } from "./api-key-store.js";
import { GeminiClient } from "./gemini-client.js";

export class GeminiClientManager {
  private clients = new Map<string, GeminiClient>();

  constructor(private store: ApiKeyStore) {}

  getClient(account: string): GeminiClient {
    const existing = this.clients.get(account);
    if (existing) return existing;

    const apiKey = this.store.get(account);
    const client = new GeminiClient(apiKey ?? undefined);
    this.clients.set(account, client);
    return client;
  }

  setApiKey(account: string, apiKey: string): GeminiClient {
    this.store.set(account, apiKey);
    const client = new GeminiClient(apiKey);
    this.clients.set(account, client);
    return client;
  }

  deleteApiKey(account: string): boolean {
    this.clients.delete(account);
    return this.store.delete(account);
  }

  listAccounts(): string[] {
    return this.store.list();
  }
}
