import type { ApiKeyStore } from "./api-key-store.js";
import { FramerClient } from "./framer-client.js";

export class FramerClientManager {
  private clients = new Map<string, FramerClient>();

  constructor(private store: ApiKeyStore) {}

  getClient(account: string): FramerClient {
    const existing = this.clients.get(account);
    if (existing) return existing;

    const json = this.store.get(account);
    const client = new FramerClient(json ?? undefined);
    this.clients.set(account, client);
    return client;
  }

  setCredentials(account: string, url: string, apiKey: string): FramerClient {
    const json = JSON.stringify({ url, apiKey });
    this.store.set(account, json);
    const client = new FramerClient(json);
    this.clients.set(account, client);
    return client;
  }

  deleteCredentials(account: string): boolean {
    const existing = this.clients.get(account);
    if (existing) {
      void existing.disconnect();
      this.clients.delete(account);
    }
    return this.store.delete(account);
  }

  listAccounts(): string[] {
    return this.store.list();
  }
}
