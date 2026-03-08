import type { ApiKeyStore } from "./api-key-store.js";
import { GitHubClient } from "./github-client.js";

export class GitHubClientManager {
  private clients = new Map<string, GitHubClient>();

  constructor(private store: ApiKeyStore) {}

  getClient(account: string): GitHubClient {
    const existing = this.clients.get(account);
    if (existing) return existing;

    const token = this.store.get(account);
    const client = new GitHubClient(token ?? undefined);
    this.clients.set(account, client);
    return client;
  }

  setToken(account: string, token: string): GitHubClient {
    this.store.set(account, token);
    const client = new GitHubClient(token);
    this.clients.set(account, client);
    return client;
  }

  deleteToken(account: string): boolean {
    this.clients.delete(account);
    return this.store.delete(account);
  }

  listAccounts(): string[] {
    return this.store.list();
  }
}
