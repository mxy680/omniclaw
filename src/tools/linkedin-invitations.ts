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
export function createLinkedInPendingInvitationsTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_pending_invitations",
    label: "LinkedIn Pending Invitations",
    description:
      "List pending incoming connection requests (invitations). Shows who wants to connect with you, including their name, headline, and message.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of invitations to retrieve (default 20, max 100).",
          default: 20,
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
      params: { count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 20, 100);
        const data = (await linkedinManager.get(
          account,
          "relationships/invitationViews",
          {
            count: String(count),
            start: "0",
            q: "receivedInvitation",
          },
        )) as { included?: Array<Record<string, unknown>>; data?: Record<string, unknown> };

        const invitations = extractEntities(data.included, "Invitation");
        const miniProfiles = extractEntities(data.included, "MiniProfile");

        // Build profile lookup
        const profileMap = new Map<string, Record<string, unknown>>();
        for (const p of miniProfiles) {
          if (typeof p.entityUrn === "string") {
            profileMap.set(p.entityUrn, p);
          }
        }

        const result = invitations.map((inv) => {
          const fromUrn = (inv["*fromMember"] ?? inv.fromMember) as string | undefined;
          const fromProfile = fromUrn ? profileMap.get(fromUrn) : undefined;

          return {
            entityUrn: inv.entityUrn,
            message: inv.message,
            sentTime: inv.sentTime,
            from: fromProfile
              ? {
                  firstName: fromProfile.firstName,
                  lastName: fromProfile.lastName,
                  headline: fromProfile.occupation,
                  publicIdentifier: fromProfile.publicIdentifier,
                  profilePicture: bestImageUrl(
                    (fromProfile.picture as Record<string, unknown>)?.["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined ??
                    fromProfile.picture as Record<string, unknown> | undefined,
                  ),
                }
              : { urn: fromUrn },
          };
        });

        return jsonResult({ count: result.length, invitations: result });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
