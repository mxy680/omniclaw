import type { SessionStore } from "./session-store.js";
import { LinkedinSessionClient } from "./linkedin-session-client.js";

export class LinkedinClientManager {
  private clients = new Map<string, LinkedinSessionClient>();

  constructor(private sessionStore: SessionStore) {}

  getClient(account: string): LinkedinSessionClient {
    const existing = this.clients.get(account);
    if (existing) return existing;

    const client = new LinkedinSessionClient(this.sessionStore, account);
    this.clients.set(account, client);
    return client;
  }

  /** Reload a specific account's session from disk (e.g. after auth). */
  reloadClient(account: string): LinkedinSessionClient {
    const client = new LinkedinSessionClient(this.sessionStore, account);
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
