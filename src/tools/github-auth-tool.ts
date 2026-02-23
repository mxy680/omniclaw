import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager";
import type { PluginConfig } from "../types/plugin-config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubAuthTool(ghManager: GitHubClientManager, config: PluginConfig): any {
  return {
    name: "github_auth_setup",
    label: "GitHub Auth Setup",
    description:
      "Authenticate with GitHub using a Personal Access Token (PAT). " +
      "The token is read from the plugin config (github_token) by default — just call with no arguments. " +
      "You can also pass a token directly. The tool validates the token by fetching your GitHub profile.",
    parameters: Type.Object({
      token: Type.Optional(
        Type.String({
          description:
            "GitHub Personal Access Token. If omitted, reads from plugin config github_token.",
        })
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'personal'). Defaults to 'default'.",
          default: "default",
        })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { token?: string; account?: string }
    ) {
      const account = params.account ?? "default";
      const token = params.token ?? config.github_token;

      if (!token) {
        return jsonResult({
          status: "error",
          error:
            "No GitHub token provided. Either pass it as a tool argument or pre-configure via: " +
            'openclaw config set plugins.entries.omniclaw.config.github_token "ghp_your_token"',
        });
      }

      // Validate by calling GET /user
      try {
        const res = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });

        if (res.status === 401) {
          return jsonResult({
            status: "error",
            error: "Token is invalid or expired. Generate a new one at https://github.com/settings/tokens",
          });
        }
        if (!res.ok) {
          return jsonResult({
            status: "error",
            error: `GitHub API returned ${res.status} ${res.statusText}`,
          });
        }

        const user = (await res.json()) as { login?: string; name?: string; email?: string };
        ghManager.setToken(account, token);

        return jsonResult({
          status: "authenticated",
          account,
          login: user.login ?? "unknown",
          name: user.name ?? "unknown",
          email: user.email ?? "unknown",
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
