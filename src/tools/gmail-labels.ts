import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailLabelsListTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_labels_list",
    label: "Gmail List Labels",
    description: "List all Gmail labels including system labels (INBOX, SENT, etc.) and user-created labels. Returns id, name, type, and message counts for each.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const res = await gmail.users.labels.list({ userId: "me" });
      const labels = res.data.labels ?? [];

      const result = labels.map((label) => ({
        id: label.id ?? "",
        name: label.name ?? "",
        type: label.type ?? "",
        messagesTotal: label.messagesTotal ?? 0,
        messagesUnread: label.messagesUnread ?? 0,
      }));

      return jsonResult(result);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailLabelCreateTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_label_create",
    label: "Gmail Create Label",
    description: "Create a new Gmail label.",
    parameters: Type.Object({
      name: Type.String({ description: "Name for the new label." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { name: string; account?: string }) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const res = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: params.name,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });

      return jsonResult({ id: res.data.id, name: res.data.name, success: true });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailLabelDeleteTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_label_delete",
    label: "Gmail Delete Label",
    description: "Permanently delete a Gmail label. Note: system labels cannot be deleted.",
    parameters: Type.Object({
      label_id: Type.String({ description: "The label ID to delete." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { label_id: string; account?: string }) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      await gmail.users.labels.delete({ userId: "me", id: params.label_id });

      return jsonResult({ label_id: params.label_id, success: true });
    },
  };
}
