import { Type } from "@sinclair/typebox";
import type { LinkedinSessionClient } from "../auth/linkedin-session-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("linkedin");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinProfileGetTool(client: LinkedinSessionClient): any {
  return {
    name: "linkedin_profile_get",
    label: "LinkedIn Profile Get",
    description: "Get the authenticated user's LinkedIn profile information.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const profile = await client.request<Record<string, unknown>>({
          path: "/me",
        });
        return jsonResult(profile);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call linkedin_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinProfileViewTool(client: LinkedinSessionClient): any {
  return {
    name: "linkedin_profile_view",
    label: "LinkedIn Profile View",
    description:
      "View another user's LinkedIn profile by their public identifier (vanity name).",
    parameters: Type.Object({
      public_id: Type.String({
        description:
          "The user's public LinkedIn identifier (vanity name from their profile URL).",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { public_id: string; account?: string },
    ) {
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const profile = await client.request<Record<string, unknown>>({
          path: `/identity/profiles/${encodeURIComponent(params.public_id)}/profileView`,
        });
        return jsonResult(profile);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call linkedin_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
