import { Type } from "@sinclair/typebox";
import type { IMessageBackend } from "./imessage-backend.js";
import { jsonResult } from "./imessage-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createImessageAttachmentsTool(backend: IMessageBackend): any {
  return {
    name: "imessage_attachments",
    label: "iMessage Attachments",
    description:
      "List file attachments (images, videos, documents, etc.) in an iMessage conversation. " +
      "Returns filename, MIME type, file path, and date for each attachment.",
    parameters: Type.Object({
      chat_id: Type.String({
        description:
          "Chat identifier from imessage_chats (e.g. 'chat123456') " +
          "or a phone number/email for 1:1 conversations.",
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of attachments to return. Defaults to 20.",
          default: 20,
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { chat_id: string; limit?: number },
    ) {
      try {
        return jsonResult(await backend.getAttachments(params));
      } catch (err) {
        return jsonResult({
          error: "attachments_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
