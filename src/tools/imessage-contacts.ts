import { Type } from "@sinclair/typebox";
import type { IMessageBackend } from "./imessage-backend.js";
import { jsonResult } from "./imessage-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createImessageContactsTool(backend: IMessageBackend): any {
  return {
    name: "imessage_contacts",
    label: "iMessage Contacts",
    description:
      "List known iMessage contacts (phone numbers and email addresses) from your Messages history. " +
      "These are handles that have appeared in conversations, not the full Contacts app.",
    parameters: Type.Object({
      search: Type.Optional(
        Type.String({
          description:
            "Filter contacts by phone number or email (case-insensitive substring match).",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of contacts to return. Defaults to 50.",
          default: 50,
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { search?: string; limit?: number },
    ) {
      try {
        return jsonResult(await backend.getContacts(params));
      } catch (err) {
        return jsonResult({
          error: "contacts_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
