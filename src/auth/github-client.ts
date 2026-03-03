import { Octokit } from "@octokit/rest";

export class GitHubClient {
  private octokit: Octokit | null = null;
  private token: string | null = null;

  constructor(token?: string) {
    if (token) {
      this.token = token;
      this.octokit = new Octokit({ auth: token });
    }
  }

  isAuthenticated(): boolean {
    return this.octokit !== null;
  }

  getClient(): Octokit {
    return this.octokit!;
  }

  setToken(token: string): void {
    this.token = token;
    this.octokit = new Octokit({ auth: token });
  }
}
