import { Type } from "@sinclair/typebox";
import type { LinkedinSessionClient } from "../auth/linkedin-session-client.js";
import type { SessionStore } from "../auth/session-store.js";
import { authenticateLinkedin } from "../auth/linkedin-browser-auth.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinAuthSetupTool(
  client: LinkedinSessionClient,
  sessionStore: SessionStore,
): any {
  return {
    name: "linkedin_auth_setup",
    label: "LinkedIn Auth Setup",
    description:
      "Authenticate with LinkedIn via browser login. Opens a browser window where you log in manually. Captures session cookies for API access.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      try {
        await authenticateLinkedin(sessionStore, account);
        client.reload(account);
        const profile = await client.request<Record<string, unknown>>({
          path: "/me",
        });
        return jsonResult({
          status: "authenticated",
          account,
          profile: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            headline: profile.headline,
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
