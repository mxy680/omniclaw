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
export function createLinkedInSendConnectionRequestTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_send_connection_request",
    label: "LinkedIn Send Connection Request",
    description:
      "Send a connection request (invitation) to another LinkedIn user. Optionally include a personalization message (max 300 characters).",
    parameters: Type.Object({
      profile_urn: Type.String({
        description:
          "The target user's profile URN (e.g. 'urn:li:fs_miniProfile:...' or 'urn:li:fsd_profile:...'). Get this from linkedin_search or linkedin_get_profile.",
      }),
      message: Type.Optional(
        Type.String({
          description: "Optional personalization note (max 300 characters).",
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
      params: { profile_urn: string; message?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const memberId = params.profile_urn.split(":").pop() ?? "";

        // Truncate message to 300 characters (LinkedIn limit)
        const message = params.message ? params.message.slice(0, 300) : undefined;

        const body: Record<string, unknown> = {
          inviteeProfileUrn: `urn:li:fsd_profile:${memberId}`,
          customMessage: message ?? "",
        };

        const data = await linkedinManager.post(
          account,
          "voyagerRelationshipsDashMemberRelationships",
          body,
          { action: "verifyQuotaAndCreate" },
        );

        return jsonResult({
          success: true,
          target: params.profile_urn,
          message: message ?? null,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
