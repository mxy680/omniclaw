import type { SessionStore } from "./session-store.js";
import { XSessionClient } from "./x-session-client.js";

export class XClientManager {
  private clients = new Map<string, XSessionClient>();

  constructor(private sessionStore: SessionStore) {}

  getClient(account: string): XSessionClient {
    const existing = this.clients.get(account);
    if (existing) return existing;

    const client = new XSessionClient(this.sessionStore, account);
    this.clients.set(account, client);
    return client;
  }

  /** Reload a specific account's session from disk (e.g. after auth). */
  reloadClient(account: string): XSessionClient {
    const client = new XSessionClient(this.sessionStore, account);
    this.clients.set(account, client);
    return client;
  }

  listAccounts(): string[] {
    return this.sessionStore.list();
  }

  getSessionStore(): SessionStore {
    return this.sessionStore;
  }
}
