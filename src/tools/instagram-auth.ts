import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { authenticateInstagram } from "../auth/instagram-browser-auth.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramAuthSetupTool(
  manager: InstagramClientManager,
): any {
  return {
    name: "instagram_auth_setup",
    label: "Instagram Auth Setup",
    description:
      "Authenticate with Instagram via browser login. Opens a browser window where you log in manually. Captures session cookies for API access.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      try {
        const sessionStore = manager.getSessionStore();
        await authenticateInstagram(sessionStore, account);
        const client = manager.reloadClient(account);
        const profile = await client.request<Record<string, unknown>>({
          path: "/accounts/current_user/info/",
        });
        const user = (profile as Record<string, unknown>).user as Record<string, unknown> | undefined;
        return jsonResult({
          status: "authenticated",
          account,
          profile: {
            username: user?.username,
            full_name: user?.full_name,
            pk: user?.pk,
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
