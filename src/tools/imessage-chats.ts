import { Type } from "@sinclair/typebox";
import type { IMessageBackend } from "./imessage-backend.js";
import { jsonResult } from "./imessage-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createImessageChatsTool(backend: IMessageBackend): any {
  return {
    name: "imessage_chats",
    label: "iMessage Chats",
    description:
      "List recent iMessage conversations (both 1:1 and group chats). " +
      "Returns chat identifier, display name, participants, and last message date.",
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of chats to return. Defaults to 20.",
          default: 20,
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { limit?: number }) {
      try {
        return jsonResult(await backend.getChats(params));
      } catch (err) {
        return jsonResult({
          error: "chats_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
