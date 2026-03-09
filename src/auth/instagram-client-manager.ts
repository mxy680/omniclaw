import type { SessionStore } from "./session-store.js";
import { InstagramSessionClient } from "./instagram-session-client.js";

export class InstagramClientManager {
  private clients = new Map<string, InstagramSessionClient>();

  constructor(private sessionStore: SessionStore) {}

  getClient(account: string): InstagramSessionClient {
    const existing = this.clients.get(account);
    if (existing) return existing;

    const client = new InstagramSessionClient(this.sessionStore, account);
    this.clients.set(account, client);
    return client;
  }

  /** Reload a specific account's session from disk (e.g. after auth). */
  reloadClient(account: string): InstagramSessionClient {
    const client = new InstagramSessionClient(this.sessionStore, account);
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
