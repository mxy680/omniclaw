import { Type } from "@sinclair/typebox";
import type { VercelClientManager } from "../auth/vercel-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelAuthTool(manager: VercelClientManager, config: PluginConfig): any {
  return {
    name: "vercel_auth_setup",
    label: "Vercel Auth Setup",
    description:
      "Authenticate with Vercel using a Personal Access Token. " +
      "The token is read from plugin config (vercel_token) by default — just call with no arguments. " +
      "You can also pass a token directly. The tool validates the token by fetching your Vercel profile.",
    parameters: Type.Object({
      token: Type.Optional(
        Type.String({
          description:
            "Vercel API token. If omitted, reads from plugin config vercel_token.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'personal'). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { token?: string; account?: string }) {
      const account = params.account ?? "default";
      const token = params.token ?? config.vercel_token;

      if (!token) {
        return jsonResult({
          status: "error",
          error:
            "No Vercel token provided. Either pass it as a tool argument or pre-configure via: " +
            'openclaw config set plugins.entries.omniclaw.config.vercel_token "your_token"',
        });
      }

      try {
        const res = await fetch("https://api.vercel.com/v2/user", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          return jsonResult({
            status: "error",
            error:
              "Token is invalid or expired. Generate a new one at https://vercel.com/account/tokens",
          });
        }
        if (!res.ok) {
          return jsonResult({
            status: "error",
            error: `Vercel API returned ${res.status} ${res.statusText}`,
          });
        }

        const data = (await res.json()) as { user?: { username?: string; name?: string; email?: string } };
        const user = data.user ?? {};
        manager.setToken(account, token);

        return jsonResult({
          status: "authenticated",
          account,
          username: user.username ?? "unknown",
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
