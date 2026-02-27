import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";
import { extractEntities } from "./linkedin-utils.js";

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
export function createLinkedInSendMessageTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_send_message",
    label: "LinkedIn Send Message",
    description:
      "Send a direct message to a LinkedIn connection. Pass the recipient's profile URN (from linkedin_search, linkedin_connections, or linkedin_get_profile) and the message text.",
    parameters: Type.Object({
      recipient_urn: Type.String({
        description:
          "The recipient's profile URN (e.g. 'urn:li:fs_miniProfile:...' or 'urn:li:fsd_profile:...'). Get this from linkedin_search, linkedin_connections, or linkedin_get_profile.",
      }),
      text: Type.String({
        description: "The message text to send.",
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
      params: { recipient_urn: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        // Get the sender's member ID from the profile
        const meData = (await linkedinManager.get(account, "me")) as {
          included?: Array<Record<string, unknown>>;
        };
        const miniProfiles = extractEntities(meData.included, "MiniProfile");
        const myProfile = miniProfiles[0];
        const myUrn = (myProfile?.entityUrn as string) ?? "";
        const myMemberId = myUrn.split(":").pop() ?? "";

        if (!myMemberId) {
          return jsonResult({ error: "Could not resolve sender profile. Re-authenticate and try again." });
        }

        // Extract recipient member ID from URN
        const recipientId = params.recipient_urn.split(":").pop() ?? "";

        // Send message via Voyager messaging REST endpoint
        const mailboxUrn = `urn:li:msg_mailbox:${myMemberId}`;
        const body = {
          dedupeByClientGeneratedToken: false,
          hostRecipientUrns: [`urn:li:fsd_profile:${recipientId}`],
          message: {
            body: {
              attributes: [],
              text: params.text,
            },
            originToken: crypto.randomUUID(),
            renderContentUnions: [],
          },
          mailboxUrn,
        };

        const data = await linkedinManager.post(
          account,
          "voyagerMessagingDashMessengerMessages",
          body,
          { action: "createMessage" },
        );

        return jsonResult({
          success: true,
          recipient: params.recipient_urn,
          text: params.text,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
