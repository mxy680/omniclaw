import { Type } from "@sinclair/typebox";
import type { LinkedinClientManager } from "../auth/linkedin-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("linkedin");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinMessagesListTool(manager: LinkedinClientManager): any {
  return {
    name: "linkedin_messages_list",
    label: "LinkedIn Messages List",
    description: "List recent LinkedIn messaging conversations.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({ description: "Number of conversations to return.", default: 20 }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const count = params.count ?? 20;
        const result = await client.request<Record<string, unknown>>({
          path: `/messaging/conversations?keyVersion=LEGACY_INBOX&count=${count}`,
          headers: {
            Accept: "application/vnd.linkedin.normalized+json+2.1",
          },
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
export function createLinkedinMessagesSendTool(manager: LinkedinClientManager): any {
  return {
    name: "linkedin_messages_send",
    label: "LinkedIn Messages Send",
    description:
      "Send a message to a LinkedIn connection. Provide either a conversation_urn (to reply in an existing thread) or a profile_url / recipient_public_id (to start a new conversation).",
    parameters: Type.Object({
      conversation_urn: Type.Optional(
        Type.String({
          description:
            "The conversation URN to send the message to (e.g., urn:li:messagingThread:2-...).",
        }),
      ),
      profile_url: Type.Optional(
        Type.String({
          description:
            "LinkedIn profile URL of the recipient (e.g. https://www.linkedin.com/in/williamhgates/).",
        }),
      ),
      recipient_public_id: Type.Optional(
        Type.String({
          description: "Public identifier (vanity name) of the recipient.",
        }),
      ),
      text: Type.String({ description: "The message text." }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        conversation_urn?: string;
        profile_url?: string;
        recipient_public_id?: string;
        text: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const messageCreate = {
          "com.linkedin.voyager.messaging.create.MessageCreate": {
            body: params.text,
            attachments: [],
            attributedBody: { text: params.text, attributes: [] },
            mediaAttachments: [],
          },
        };

        if (params.conversation_urn) {
          // Reply in existing conversation
          const result = await client.request<Record<string, unknown>>({
            method: "POST",
            path: `/messaging/conversations/${params.conversation_urn}/events?action=create`,
            body: {
              eventCreate: { value: messageCreate },
              dedupeByClientGeneratedToken: false,
            },
          });
          return jsonResult({ status: "sent", ...result });
        }

        // Resolve recipient to URN via profile lookup
        const raw = params.profile_url ?? params.recipient_public_id;
        if (!raw) {
          return jsonResult({
            error: "missing_param",
            message: "Provide conversation_urn, profile_url, or recipient_public_id.",
          });
        }
        const publicId = extractPublicId(raw);

        // Look up profile URN via dash API
        const profileData = await client.request<Record<string, unknown>>({
          path: `/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicId)}`,
        });
        const elements = (profileData as { elements?: Array<{ entityUrn?: string }> }).elements;
        const profileUrn = elements?.[0]?.entityUrn;
        if (!profileUrn) {
          return jsonResult({ error: "profile_not_found", message: `Could not resolve profile for ${publicId}.` });
        }

        // Create new conversation with recipient
        const result = await client.request<Record<string, unknown>>({
          method: "POST",
          path: "/messaging/conversations?action=create",
          body: {
            keyVersion: "LEGACY_INBOX",
            conversationCreate: {
              eventCreate: { value: messageCreate },
              recipients: [profileUrn],
              subtype: "MEMBER_TO_MEMBER",
            },
          },
        });
        return jsonResult({ status: "sent", ...result });
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
