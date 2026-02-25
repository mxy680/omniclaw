import { Type } from "@sinclair/typebox";
import type { BlueBubblesClientManager } from "../auth/bluebubbles-client-manager.js";
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
export function createImessageBBAuthTool(manager: BlueBubblesClientManager, config: PluginConfig): any {
  return {
    name: "imessage_bb_auth_setup",
    label: "BlueBubbles Auth Setup",
    description:
      "Connect to a BlueBubbles server for cross-platform iMessage access. " +
      "Provide the server URL and password, or they will be read from plugin config " +
      "(bluebubbles_url, bluebubbles_password). Validates by querying the server info endpoint.",
    parameters: Type.Object({
      url: Type.Optional(
        Type.String({
          description:
            "BlueBubbles server URL (e.g. 'http://192.168.1.100:1234'). If omitted, reads from plugin config.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description:
            "BlueBubbles server password. If omitted, reads from plugin config.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'personal'). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { url?: string; password?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const url = params.url ?? config.bluebubbles_url;
      const password = params.password ?? config.bluebubbles_password;

      if (!url || !password) {
        return jsonResult({
          status: "error",
          error:
            "BlueBubbles URL and password are required. Either pass them as tool arguments or pre-configure via: " +
            'openclaw config set plugins.entries.omniclaw.config.bluebubbles_url "http://your-server:1234" && ' +
            'openclaw config set plugins.entries.omniclaw.config.bluebubbles_password "your_password"',
        });
      }

      try {
        // Validate by calling the server info endpoint
        const normalizedUrl = url.replace(/\/+$/, "");
        const infoUrl = new URL("/api/v1/server/info", normalizedUrl);
        infoUrl.searchParams.set("password", password);

        const res = await fetch(infoUrl.toString());
        if (!res.ok) {
          return jsonResult({
            status: "error",
            error: `BlueBubbles server returned ${res.status}: ${await res.text()}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const info = (await res.json()) as { status: number; data: any };

        // Store credentials
        manager.setConfig(account, normalizedUrl, password);

        return jsonResult({
          status: "authenticated",
          account,
          server_url: normalizedUrl,
          os_version: info.data?.os_version ?? "unknown",
          server_version: info.data?.server_version ?? "unknown",
          message: "BlueBubbles server connected. iMessage tools will now use the BlueBubbles API.",
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
