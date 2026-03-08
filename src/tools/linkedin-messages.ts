import { Type } from "@sinclair/typebox";
import type { LinkedinSessionClient } from "../auth/linkedin-session-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("linkedin");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinMessagesListTool(client: LinkedinSessionClient): any {
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
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const count = params.count ?? 20;
        const result = await client.request<Record<string, unknown>>({
          path: `/messaging/dash/conversations?q=search&count=${count}`,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinMessagesSendTool(client: LinkedinSessionClient): any {
  return {
    name: "linkedin_messages_send",
    label: "LinkedIn Messages Send",
    description: "Send a message to a LinkedIn connection.",
    parameters: Type.Object({
      conversation_urn: Type.String({
        description:
          "The conversation URN to send the message to (e.g., urn:li:messagingThread:2-...).",
      }),
      text: Type.String({ description: "The message text." }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { conversation_urn: string; text: string; account?: string },
    ) {
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const encodedUrn = encodeURIComponent(params.conversation_urn);
        const result = await client.request<Record<string, unknown>>({
          method: "POST",
          path: `/messaging/dash/conversations/${encodedUrn}/messages`,
          body: {
            body: params.text,
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
