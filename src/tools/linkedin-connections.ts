import { Type } from "@sinclair/typebox";
import type { LinkedinClientManager } from "../auth/linkedin-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("linkedin");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinConnectionsListTool(manager: LinkedinClientManager): any {
  return {
    name: "linkedin_connections_list",
    label: "LinkedIn Connections List",
    description: "List the authenticated user's 1st-degree connections.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.Number({ description: "Pagination start index.", default: 0 }),
      ),
      count: Type.Optional(
        Type.Number({ description: "Number of connections to return.", default: 20 }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: number; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const start = params.start ?? 0;
        const count = params.count ?? 20;
        const result = await client.request<Record<string, unknown>>({
          path: `/relationships/dash/connections?q=search&start=${start}&count=${count}`,
        });
        return jsonResult(result);
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
