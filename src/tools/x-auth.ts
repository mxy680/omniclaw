import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { authenticateX } from "../auth/x-browser-auth.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXAuthSetupTool(
  manager: XClientManager,
): any {
  return {
    name: "x_auth_setup",
    label: "X Auth Setup",
    description:
      "Authenticate with X (Twitter) via browser login. Opens a browser window where you log in manually. Captures session cookies for API access.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      try {
        const sessionStore = manager.getSessionStore();
        await authenticateX(sessionStore, account);
        const client = manager.reloadClient(account);
        // Verify by fetching user settings
        const result = await client.v1<Record<string, unknown>>({
          path: "/account/settings.json",
        });
        return jsonResult({
          status: "authenticated",
          account,
          profile: {
            screen_name: result?.screen_name,
          },
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "auth_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
