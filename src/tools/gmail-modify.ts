import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager";

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
  action: "Call gmail_auth_setup to authenticate.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailModifyTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_modify",
    label: "Gmail Modify",
    description:
      "Change the state of a Gmail message: mark as read/unread, archive (remove from inbox), or move to trash.",
    parameters: Type.Object({
      id: Type.String({ description: "The Gmail message ID to modify." }),
      action: Type.Union(
        [
          Type.Literal("mark_read"),
          Type.Literal("mark_unread"),
          Type.Literal("archive"),
          Type.Literal("trash"),
        ],
        {
          description:
            "Action to perform: 'mark_read', 'mark_unread', 'archive' (remove from inbox), or 'trash'.",
        }
      ),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { id: string; action: "mark_read" | "mark_unread" | "archive" | "trash"; account?: string }
    ) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      switch (params.action) {
        case "mark_read":
          await gmail.users.messages.modify({
            userId: "me",
            id: params.id,
            requestBody: { removeLabelIds: ["UNREAD"] },
          });
          break;

        case "mark_unread":
          await gmail.users.messages.modify({
            userId: "me",
            id: params.id,
            requestBody: { addLabelIds: ["UNREAD"] },
          });
          break;

        case "archive":
          await gmail.users.messages.modify({
            userId: "me",
            id: params.id,
            requestBody: { removeLabelIds: ["INBOX"] },
          });
          break;

        case "trash":
          await gmail.users.messages.trash({ userId: "me", id: params.id });
          break;
      }

      return jsonResult({ id: params.id, action: params.action, success: true });
    },
  };
}
