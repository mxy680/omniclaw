import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";

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
export function createLinkedInRespondInvitationTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_respond_invitation",
    label: "LinkedIn Respond to Invitation",
    description:
      "Accept or decline a pending connection request. Pass the invitation URN from linkedin_pending_invitations.",
    parameters: Type.Object({
      invitation_urn: Type.String({
        description:
          "The invitation URN (e.g. 'urn:li:fsd_invitation:...'). Get this from linkedin_pending_invitations.",
      }),
      action: Type.String({
        description: "Action to take: 'accept' or 'decline'.",
      }),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { invitation_urn: string; action: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const actionLower = params.action.toLowerCase();
        if (actionLower !== "accept" && actionLower !== "decline") {
          return jsonResult({ error: "action must be 'accept' or 'decline'" });
        }

        const encodedUrn = encodeURIComponent(params.invitation_urn);

        let data: unknown;
        if (actionLower === "accept") {
          data = await linkedinManager.post(
            account,
            `voyagerRelationshipsDashInvitations/${encodedUrn}`,
            {},
            { action: "accept" },
          );
        } else {
          data = await linkedinManager.delete(
            account,
            `voyagerRelationshipsDashInvitations/${encodedUrn}`,
            { action: "reject" },
          );
        }

        return jsonResult({
          success: true,
          invitation: params.invitation_urn,
          action: actionLower,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
