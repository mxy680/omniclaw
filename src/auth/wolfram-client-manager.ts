import type { ApiKeyStore } from "./api-key-store.js";
import { WolframClient } from "./wolfram-client.js";

export class WolframClientManager {
  private clients = new Map<string, WolframClient>();

  constructor(private store: ApiKeyStore) {}

  getClient(account: string): WolframClient {
    const existing = this.clients.get(account);
    if (existing) return existing;

    const appId = this.store.get(account);
    const client = new WolframClient(appId ?? undefined);
    this.clients.set(account, client);
    return client;
  }

  setAppId(account: string, appId: string): WolframClient {
    this.store.set(account, appId);
    const client = new WolframClient(appId);
    this.clients.set(account, client);
    return client;
  }

  deleteAppId(account: string): boolean {
    this.clients.delete(account);
    return this.store.delete(account);
  }

  listAccounts(): string[] {
    return this.store.list();
  }
}
