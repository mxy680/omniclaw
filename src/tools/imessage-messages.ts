import { Type } from "@sinclair/typebox";
import type { IMessageBackend } from "./imessage-backend.js";
import { jsonResult } from "./imessage-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createImessageMessagesTool(backend: IMessageBackend): any {
  return {
    name: "imessage_messages",
    label: "iMessage Messages",
    description:
      "Read messages from a specific iMessage conversation. " +
      "Pass a chat identifier (from imessage_chats) or a phone number/email to read 1:1 messages.",
    parameters: Type.Object({
      chat_id: Type.String({
        description:
          "Chat identifier — either the chat_id from imessage_chats (e.g. 'chat123456') " +
          "or a phone number/email for 1:1 conversations (e.g. '+15551234567').",
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of messages to return. Defaults to 50.",
          default: 50,
        }),
      ),
      before: Type.Optional(
        Type.String({
          description:
            "Return messages before this ISO date string for pagination (e.g. '2025-01-15T00:00:00Z').",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { chat_id: string; limit?: number; before?: string },
    ) {
      try {
        return jsonResult(await backend.getMessages(params));
      } catch (err) {
        return jsonResult({
          error: "messages_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createImessageSearchTool(backend: IMessageBackend): any {
  return {
    name: "imessage_search",
    label: "iMessage Search",
    description:
      "Full-text search across all iMessage conversations. " +
      "Searches message content and returns matching messages with their conversation context.",
    parameters: Type.Object({
      query: Type.String({
        description: "Text to search for in messages.",
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results to return. Defaults to 25.",
          default: 25,
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; limit?: number },
    ) {
      try {
        return jsonResult(await backend.searchMessages(params));
      } catch (err) {
        return jsonResult({
          error: "search_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
