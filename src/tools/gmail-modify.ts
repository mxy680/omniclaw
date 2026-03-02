import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailModifyTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_modify",
    label: "Gmail Modify",
    description:
      "Change the state of a Gmail message: mark as read/unread, archive (remove from inbox), move to trash, untrash, star/unstar, or add/remove specific labels.",
    parameters: Type.Object({
      id: Type.String({ description: "The Gmail message ID to modify." }),
      action: Type.Union(
        [
          Type.Literal("mark_read"),
          Type.Literal("mark_unread"),
          Type.Literal("archive"),
          Type.Literal("trash"),
          Type.Literal("untrash"),
          Type.Literal("star"),
          Type.Literal("unstar"),
          Type.Literal("add_labels"),
          Type.Literal("remove_labels"),
        ],
        {
          description:
            "Action to perform: 'mark_read', 'mark_unread', 'archive' (remove from inbox), 'trash', 'untrash', 'star', 'unstar', 'add_labels', or 'remove_labels'.",
        },
      ),
      label_ids: Type.Optional(
        Type.Array(Type.String(), {
          description: "Label IDs to add or remove. Required for add_labels/remove_labels actions.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        id: string;
        action:
          | "mark_read"
          | "mark_unread"
          | "archive"
          | "trash"
          | "untrash"
          | "star"
          | "unstar"
          | "add_labels"
          | "remove_labels";
        label_ids?: string[];
        account?: string;
      },
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

        case "untrash":
          await gmail.users.messages.untrash({ userId: "me", id: params.id });
          break;

        case "star":
          await gmail.users.messages.modify({
            userId: "me",
            id: params.id,
            requestBody: { addLabelIds: ["STARRED"] },
          });
          break;

        case "unstar":
          await gmail.users.messages.modify({
            userId: "me",
            id: params.id,
            requestBody: { removeLabelIds: ["STARRED"] },
          });
          break;

        case "add_labels":
          await gmail.users.messages.modify({
            userId: "me",
            id: params.id,
            requestBody: { addLabelIds: params.label_ids ?? [] },
          });
          break;

        case "remove_labels":
          await gmail.users.messages.modify({
            userId: "me",
            id: params.id,
            requestBody: { removeLabelIds: params.label_ids ?? [] },
          });
          break;
      }

      return jsonResult({ id: params.id, action: params.action, success: true });
    },
  };
}
