import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";
import { extractEntities, bestImageUrl } from "./linkedin-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call linkedin_auth_setup to authenticate with LinkedIn first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInConnectionsTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_connections",
    label: "LinkedIn Connections",
    description: "List your LinkedIn connections sorted by most recently added. Returns name, headline, and profile identifier for each connection.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of connections to retrieve (default 20, max 100).",
          default: 20,
        }),
      ),
      start: Type.Optional(
        Type.Number({
          description: "Pagination offset (default 0).",
          default: 0,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { count?: number; start?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 20, 100);
        const start = params.start ?? 0;
        const data = (await linkedinManager.get(
          account,
          "relationships/connections",
          {
            sortType: "RECENTLY_ADDED",
            count: String(count),
            start: String(start),
          },
        )) as { included?: Array<Record<string, unknown>>; paging?: Record<string, unknown> };

        const miniProfiles = extractEntities(data.included, "MiniProfile");

        const connections = miniProfiles.map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          headline: p.occupation,
          publicIdentifier: p.publicIdentifier,
          entityUrn: p.entityUrn,
          profilePicture: bestImageUrl(
            (p.picture as Record<string, unknown>)?.["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined ??
            p.picture as Record<string, unknown> | undefined,
          ),
        }));

        return jsonResult({
          count: connections.length,
          total: (data.paging as Record<string, unknown> | undefined)?.total ?? null,
          connections,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
