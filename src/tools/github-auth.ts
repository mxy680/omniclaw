import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubAuthSetupTool(manager: GitHubClientManager): any {
  return {
    name: "github_auth_setup",
    label: "GitHub Auth Setup",
    description:
      "Validate a GitHub Personal Access Token and return the authenticated user info. Call this before using any other GitHub tool.",
    parameters: Type.Object({
      token: Type.String({
        description: "GitHub Personal Access Token (classic or fine-grained).",
      }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { token: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.setToken(account, params.token);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.users.getAuthenticated();
        return jsonResult({
          login: data.login,
          name: data.name,
          email: data.email,
          bio: data.bio,
          public_repos: data.public_repos,
          followers: data.followers,
          following: data.following,
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "auth_failed",
          message: err instanceof Error ? err.message : String(err),
          note: "The token may be invalid or lack required permissions.",
        });
      }
    },
  };
}
