import { Type } from "@sinclair/typebox";
import type { LinkedinClientManager } from "../auth/linkedin-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("linkedin");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinProfileGetTool(manager: LinkedinClientManager): any {
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
      const account = params.account ?? "default";
      const client = manager.getClient(account);
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

/** Extract the public identifier (vanity name) from a LinkedIn profile URL or return as-is. */
function extractPublicId(input: string): string {
  try {
    const url = new URL(input);
    const match = url.pathname.match(/\/in\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch { /* not a URL, treat as raw public_id */ }
  return input;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinProfileViewTool(manager: LinkedinClientManager): any {
  return {
    name: "linkedin_profile_view",
    label: "LinkedIn Profile View",
    description:
      "View another user's LinkedIn profile by their public identifier (vanity name) or profile URL.",
    parameters: Type.Object({
      public_id: Type.Optional(
        Type.String({
          description:
            "The user's public LinkedIn identifier (vanity name from their profile URL).",
        }),
      ),
      profile_url: Type.Optional(
        Type.String({
          description:
            "Full LinkedIn profile URL (e.g. https://www.linkedin.com/in/williamhgates/).",
        }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { public_id?: string; profile_url?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);

      const raw = params.public_id ?? params.profile_url;
      if (!raw) {
        return jsonResult({ error: "missing_param", message: "Provide public_id or profile_url." });
      }
      const publicId = extractPublicId(raw);

      try {
        const profile = await client.request<Record<string, unknown>>({
          path: `/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicId)}`,
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
